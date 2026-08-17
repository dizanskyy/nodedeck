package main

import (
	"bytes"
	"encoding/base64"
	"errors"
	"image"
	"image/jpeg"

	"github.com/kbinani/screenshot"
)

// captureScreen снимает рабочий стол.
//
// Ограничения по платформам:
//   Windows  — работает, если агент запущен в интерактивной сессии.
//              Служба в Session 0 экрана НЕ видит: нужен отдельный
//              user-mode helper, запускаемый через CreateProcessAsUser.
//   Linux/X11 — требуется DISPLAY и XAUTHORITY доступного пользователя.
//   Wayland   — X11-захват не работает; нужен портал
//              org.freedesktop.portal.Screenshot через D-Bus.
//   Headless-сервер — дисплеев нет, вернётся ошибка. Это ожидаемо.
func captureScreen(req ScreenshotRequest) (*ScreenshotResponse, error) {
	n := screenshot.NumActiveDisplays()
	if n == 0 {
		return nil, errors.New("активных дисплеев нет (headless-сервер или служба вне интерактивной сессии)")
	}

	var img *image.RGBA
	var err error
	if req.Display < 0 {
		// Все мониторы одним кадром: объединяем их прямоугольники.
		bounds := screenshot.GetDisplayBounds(0)
		for i := 1; i < n; i++ {
			bounds = bounds.Union(screenshot.GetDisplayBounds(i))
		}
		img, err = screenshot.CaptureRect(bounds)
	} else {
		if req.Display >= n {
			return nil, errors.New("дисплей не найден")
		}
		img, err = screenshot.CaptureDisplay(req.Display)
	}
	if err != nil {
		return nil, err
	}

	q := req.Quality
	if q <= 0 || q > 100 {
		q = 70 // компромисс: читаемый текст при ~150 КБ на 1080p
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: q}); err != nil {
		return nil, err
	}
	return &ScreenshotResponse{
		Width:  img.Bounds().Dx(),
		Height: img.Bounds().Dy(),
		Format: "jpeg",
		Data:   base64.StdEncoding.EncodeToString(buf.Bytes()),
	}, nil
}
