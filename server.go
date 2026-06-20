package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	// You will need to ensure this imports your internal backend package
	// Replace "spotiflac/backend" with your actual go.mod module name if different.
	"spotiflac/backend"
)

// Request payloads matching the frontend
type SearchRequest struct {
	Query      string `json:"query"`
	SearchType string `json:"search_type"`
	Limit      int    `json:"limit"`
	Offset     int    `json:"offset"`
}

type DownloadRequest struct {
	SpotifyID string `json:"spotify_id"`
	Service   string `json:"service"` // e.g., "tidal", "qobuz"
}

func main() {
	// Dynamically bind to Railway's assigned port
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" 
	}

	// Initialize backend caches and configurations (similar to app.go)
	backend.InitConfig()
	backend.InitCaches()

	// Register API endpoints
	http.HandleFunc("/api/search", handleSearch)
	http.HandleFunc("/api/download", handleDownload)

	log.Printf("SpotiFLAC Web API running on port %s...\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// CORS Middleware for Cloudflare Pages communication
func enableCORS(w *http.ResponseWriter, r *http.Request) bool {
	(*w).Header().Set("Access-Control-Allow-Origin", "*") // Update to your Cloudflare URL in production
	(*w).Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	(*w).Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	
	if r.Method == "OPTIONS" {
		(*w).WriteHeader(http.StatusOK)
		return true
	}
	return false
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	if enableCORS(&w, r) { return }

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	// Call the spotfetch logic to query Spotify without a user login
	results, err := backend.SearchSpotify(req.Query, req.SearchType, req.Limit, req.Offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func handleDownload(w http.ResponseWriter, r *http.Request) {
	if enableCORS(&w, r) { return }

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req DownloadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	// Tell the browser to expect a downloadable audio file
	w.Header().Set("Content-Type", "audio/flac")
	w.Header().Set("Content-Disposition", `attachment; filename="`+req.SpotifyID+`.flac"`)

	// Stream track bytes directly to the HTTP response writer 
	// Note: You will need to adapt your specific provider (Tidal/Qobuz) to write to `w` (io.Writer) 
	// instead of saving directly to a local file path.
	err := backend.DownloadAndStreamTrack(req.SpotifyID, req.Service, w)
	if err != nil {
		log.Printf("Streaming error: %v", err)
	}
}
