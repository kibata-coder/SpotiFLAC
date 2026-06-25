package main

import (
	"io"
	"path/filepath"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

// Global reference to the SpotiFLAC core application
var engine *App

func cleanupCacheRoutine() {
	for {
		time.Sleep(15 * time.Minute)
		files, err := os.ReadDir("./cache")
		if err != nil {
			continue
		}
		now := time.Now()
		for _, f := range files {
			if f.IsDir() { continue }
			info, err := f.Info()
			if err == nil && now.Sub(info.ModTime()) > 1*time.Hour {
				os.Remove(filepath.Join("./cache", f.Name()))
			}
		}
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	os.MkdirAll("./cache", 0755)
	go cleanupCacheRoutine()

	// 1. Initialize the existing SpotiFLAC App from app.go
	engine = NewApp()
	
	// 2. Assign a standard web context (Replacing the Wails desktop context)
	engine.ctx = context.Background()

	// 3. Register our web endpoints
	http.HandleFunc("/api/search", handleSearch)
	http.HandleFunc("/api/download", handleDownload)
	http.HandleFunc("/api/stream", handleStream)

	// 4. Serve the compiled frontend as static files
	fs := http.FileServer(http.Dir("./frontend/dist"))
	http.Handle("/", fs)

	log.Printf("Railway Web Server active on port %s...\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server crashed: %v", err)
	}
}

func enableCORS(w *http.ResponseWriter, r *http.Request) bool {
	(*w).Header().Set("Access-Control-Allow-Origin", "*") 
	(*w).Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	(*w).Header().Set("Access-Control-Allow-Headers", "Content-Type")
	
	if r.Method == "OPTIONS" {
		(*w).WriteHeader(http.StatusOK)
		return true
	}
	return false
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	if enableCORS(&w, r) { return }

	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	query, _ := req["query"].(string)
	searchType, _ := req["search_type"].(string)
	
	searchReq := SpotifySearchByTypeRequest{
		Query:      query,
		SearchType: searchType,
		Limit:      20,
		Offset:     0,
	}

	results, err := engine.SearchSpotifyByType(searchReq)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func downloadToCache(spotifyID, service string) (string, error) {
	reqData := DownloadRequest{
		SpotifyID: spotifyID,
		Service:   service,
		OutputDir: "./cache",
	}

	resp, err := engine.DownloadTrack(reqData)
	if err != nil {
		return "", err
	}
	if !resp.Success || resp.File == "" {
		return "", fmt.Errorf("%s", resp.Error)
	}
	return resp.File, nil
}

func handleDownload(w http.ResponseWriter, r *http.Request) {
	if enableCORS(&w, r) { return }

	var reqData DownloadRequest
	if err := json.NewDecoder(r.Body).Decode(&reqData); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	file, err := downloadToCache(reqData.SpotifyID, reqData.Service)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "audio/flac")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+filepath.Base(file)+"\"")
	http.ServeFile(w, r, file)
}

func handleStream(w http.ResponseWriter, r *http.Request) {
	if enableCORS(&w, r) { return }

	spotifyID := r.URL.Query().Get("spotify_id")
	service := r.URL.Query().Get("service")
	if service == "" {
		service = "tidal"
	}

	if spotifyID == "" {
		http.Error(w, "spotify_id is required", http.StatusBadRequest)
		return
	}

	file, err := downloadToCache(spotifyID, service)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Serve the file inline for streaming with Range support
	w.Header().Set("Content-Type", "audio/flac")
	w.Header().Set("Content-Disposition", "inline; filename=\""+filepath.Base(file)+"\"")
	http.ServeFile(w, r, file)
}
