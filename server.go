package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
)

// Global reference to the SpotiFLAC core application
var engine *App

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// 1. Initialize the existing SpotiFLAC App from app.go
	engine = NewApp()
	
	// 2. Assign a standard web context (Replacing the Wails desktop context)
	engine.ctx = context.Background()

	// 3. Register our web endpoints
	http.HandleFunc("/api/search", handleSearch)
	http.HandleFunc("/api/download", handleDownload)

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

// Bridges your web UI to the SearchSpotifyByType method in app.go
func handleSearch(w http.ResponseWriter, r *http.Request) {
	if enableCORS(&w, r) { return }

	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	// Safely extract payload variables
	query, _ := req["query"].(string)
	searchType, _ := req["search_type"].(string)
	limit := 20
	offset := 0

	// Execute original search logic
	results := engine.SearchSpotifyByType(query, searchType, limit, offset)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// Bridges your web UI to the DownloadTrack method in app.go
func handleDownload(w http.ResponseWriter, r *http.Request) {
	if enableCORS(&w, r) { return }

	var reqData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&reqData); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	// Note: Because app.go natively writes to the local hard drive, 
	// for a complete web-streaming experience you will eventually need to alter 
	// app.go so that it pipes the final FLAC binary directly into the HTTP response (w).
	// For now, this triggers the download loop correctly.
	engine.DownloadTrack(reqData)
	
	w.WriteHeader(http.StatusOK)
}
