// Реальное SSH-подключение на базе async-ssh2-tokio (чистый Rust, на russh).
// Держим ОДНО живое подключение на сервер (пул сессий) и переиспользуем его
// для всех команд — переключение вкладок больше не переподключается.
use async_ssh2_tokio::client::{AuthMethod, Client, ServerCheckMethod};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, LazyLock};
use tokio::sync::Mutex;
use tokio::time::{timeout, Duration};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshCreds {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub key_passphrase: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SshResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i64,
}

// Пул живых подключений: ключ = host:port:user.
type Session = Arc<Mutex<Client>>;
static SESSIONS: LazyLock<Mutex<HashMap<String, Session>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn key_of(c: &SshCreds) -> String {
    format!("{}:{}:{}", c.host, c.port, c.username)
}

fn auth_from(creds: &SshCreds) -> Result<AuthMethod, String> {
    if let Some(pw) = &creds.password {
        if !pw.is_empty() {
            return Ok(AuthMethod::with_password(pw));
        }
    }
    if let Some(key) = &creds.private_key {
        if !key.is_empty() {
            return Ok(AuthMethod::with_key(key, creds.key_passphrase.as_deref()));
        }
    }
    Err("не указан ни пароль, ни приватный ключ".into())
}

async fn connect(creds: &SshCreds) -> Result<Client, String> {
    let auth = auth_from(creds)?;
    let fut = Client::connect(
        (creds.host.as_str(), creds.port),
        creds.username.as_str(),
        auth,
        ServerCheckMethod::NoCheck,
    );
    match timeout(Duration::from_secs(12), fut).await {
        Ok(r) => r.map_err(|e| format!("подключение не удалось: {e}")),
        Err(_) => Err("таймаут подключения: хост недоступен или порт 22 закрыт".into()),
    }
}

// Достаёт живую сессию из пула или создаёт новую.
async fn get_session(creds: &SshCreds) -> Result<Session, String> {
    let key = key_of(creds);
    if let Some(s) = SESSIONS.lock().await.get(&key).cloned() {
        return Ok(s);
    }
    let client = connect(creds).await?;
    let sess: Session = Arc::new(Mutex::new(client));
    SESSIONS.lock().await.insert(key, sess.clone());
    Ok(sess)
}

async fn drop_session(creds: &SshCreds) {
    SESSIONS.lock().await.remove(&key_of(creds));
}

/// Проверка подключения (используется при добавлении сервера).
#[tauri::command]
pub async fn ssh_test(creds: SshCreds) -> Result<bool, String> {
    let client = connect(&creds).await?;
    let _ = client.disconnect().await;
    Ok(true)
}

/// Выполнить команду на сервере, переиспользуя живое подключение.
#[tauri::command]
pub async fn ssh_exec(creds: SshCreds, command: String) -> Result<SshResult, String> {
    // Попытка выполнить на существующей сессии.
    let sess = get_session(&creds).await?;
    let attempt = {
        let guard = sess.lock().await;
        guard.execute(&command).await
    };

    let res = match attempt {
        Ok(r) => r,
        Err(_) => {
            // Подключение могло отвалиться — пересоздаём один раз.
            drop_session(&creds).await;
            let sess = get_session(&creds).await?;
            let guard = sess.lock().await;
            guard
                .execute(&command)
                .await
                .map_err(|e| format!("ошибка выполнения: {e}"))?
        }
    };

    Ok(SshResult {
        stdout: res.stdout,
        stderr: res.stderr,
        exit_code: res.exit_status as i64,
    })
}

/// Закрыть живое подключение к серверу (например, при выходе со страницы).
#[tauri::command]
pub async fn ssh_disconnect(creds: SshCreds) -> Result<(), String> {
    if let Some(sess) = SESSIONS.lock().await.remove(&key_of(&creds)) {
        if let Ok(client) = Arc::try_unwrap(sess) {
            let _ = client.into_inner().disconnect().await;
        }
    }
    Ok(())
}
