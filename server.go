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

	// 1. Pack the variables into the struct app.go expects
	searchReq := SpotifySearchByTypeRequest{
		Query:      query,
		SearchType: searchType,
		Limit:      limit,
		Offset:     offset,
	}

	// 2. Execute original search logic and capture both results AND the error
	results, err := engine.SearchSpotifyByType(searchReq)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// Bridges your web UI to the DownloadTrack method in app.go
func handleDownload(w http.ResponseWriter, r *http.Request) {
	if enableCORS(&w, r) { return }

	// 1. Decode the JSON directly into the DownloadRequest struct defined in app.go
	var reqData DownloadRequest
	if err := json.NewDecoder(r.Body).Decode(&reqData); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	// 2. Call the engine and capture the response/error
	resp, err := engine.DownloadTrack(reqData)
	
	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
	} else {
		w.WriteHeader(http.StatusOK)
	}
	
	// Send the detailed response back to the frontend
	json.NewEncoder(w).Encode(resp)
}
