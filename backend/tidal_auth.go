package backend

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

var (
	tidalToken      string
	tidalTokenMux   sync.Mutex
	tidalTokenExp   time.Time
)

func getTidalClientID() string {
	if id := os.Getenv("TIDAL_CLIENT_ID"); id != "" {
		return id
	}
	return "dR7zD87eGc6eL8Mc"
}

func getTidalClientSecret() string {
	if secret := os.Getenv("TIDAL_CLIENT_SECRET"); secret != "" {
		return secret
	}
	return "kE6E3pzt8dzXB70IyfBZVSnHmtVRl3xisXei2aWfg0g="
}

type tidalTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

func GetTidalBearerToken() (string, error) {
	tidalTokenMux.Lock()
	defer tidalTokenMux.Unlock()

	if tidalToken != "" && time.Now().Before(tidalTokenExp) {
		return tidalToken, nil
	}

	clientID := getTidalClientID()
	clientSecret := getTidalClientSecret()

	authString := base64.StdEncoding.EncodeToString([]byte(clientID + ":" + clientSecret))

	data := url.Values{}
	data.Set("grant_type", "client_credentials")

	req, err := http.NewRequest("POST", "https://auth.tidal.com/v1/oauth2/token", strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Basic "+authString)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to request token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("auth returned status %d: %s", resp.StatusCode, string(body))
	}

	var tr tidalTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tr); err != nil {
		return "", fmt.Errorf("failed to decode token response: %w", err)
	}

	tidalToken = tr.AccessToken
	// Subtract 10 seconds for safety
	tidalTokenExp = time.Now().Add(time.Duration(tr.ExpiresIn-10) * time.Second)

	return tidalToken, nil
}

// Native Tidal API playback response
type TidalDirectAPIResponse struct {
	TrackID           int64  `json:"trackId"`
	AssetPresentation string `json:"assetPresentation"`
	AudioMode         string `json:"audioMode"`
	AudioQuality      string `json:"audioQuality"`
	ManifestMimeType  string `json:"manifestMimeType"`
	ManifestHash      string `json:"manifestHash"`
	Manifest          string `json:"manifest"`
}
