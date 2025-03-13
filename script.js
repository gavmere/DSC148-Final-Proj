const url = 'spotify_tracks_dataset.csv';
let trackData = [];

function displayTrackInfo(track) {
    const trackInfoContainer = document.getElementById('track-info');
    trackInfoContainer.innerHTML = '';

    if (track) {
        const trackInfoElement = document.createElement('p');
        trackInfoElement.textContent = `Track: ${track.track_name} - ${track.artists}`;
        trackInfoContainer.appendChild(trackInfoElement);
    } else {
        const errorMessage = document.createElement('p');
        errorMessage.textContent = "No track data found.";
        errorMessage.style.color = "red";
        trackInfoContainer.appendChild(errorMessage);
    }
}

async function recommend(df, songName, artistName, nRecs, distance) {
    const relevantColumns = ['popularity', 'danceability', 'energy', 'loudness', 'mode', 'speechiness', 'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo'];
    const songSearchArr = df.filter(song => song.track_name === songName && song.artists === artistName);

    if (songSearchArr.length === 0) {
        return "Song not found in the dataframe.";
    }

    const songSearch = relevantColumns.map(col => songSearchArr[0][col]);
    const songMatrix = df.map(song => relevantColumns.map(col => song[col]));
    const songNames = df.map(song => song.track_name);
    const songArtists = df.map(song => song.artists);
    const targetIndex = songNames.indexOf(songName);

    let distances;

    if (distance === 'cosine') {
      distances = df.map(song => 1 - cosineSimilarity(songSearch, relevantColumns.map(col => song[col])));
    } else if (distance === 'euclidean') {
      distances = df.map(song => euclideanDistance(songSearch, relevantColumns.map(col => song[col])));
    } else {
      return "Invalid distance metric. Choose 'cosine' or 'euclidean'.";
    }

    let songDistances = songNames.map((name, index) => [name, songArtists[index], distances[index]]);
    songDistances = songDistances.filter((song, index) => !(song[0] === songName && song[1] === artistName));

    const uniqueSongs = [];
    const seen = new Set();

    for (const song of songDistances) {
        const key = `${song[0]} - ${song[1]}`;
        if (!seen.has(key)) {
            uniqueSongs.push(song);
            seen.add(key);
        }
    }

    uniqueSongs.sort((a, b) => a[2] - b[2]);
    const recommendedSongs = uniqueSongs.slice(0, nRecs);
    return recommendedSongs;
}

function displayRecommendations(recommendations, metric){
    const recommendationsContainer = document.getElementById('recommendations');
    recommendationsContainer.innerHTML = '';

    if (typeof recommendations === 'string') {
        const errorMessage = document.createElement('p');
        errorMessage.textContent = recommendations;
        errorMessage.className = 'error-message';
        recommendationsContainer.appendChild(errorMessage);
    } else if (recommendations) {
        recommendations.forEach(song => {
            const trackName = song[0];
            const artistName = song[1];
            
            const trackData = findTrackData(trackName, artistName);
            
            const box = document.createElement('div');
            box.className = 'recommendation-box';
            
            const songInfo = document.createElement('div');
            songInfo.className = 'song-info';
            
            const songNameEl = document.createElement('h3');
            songNameEl.textContent = trackName;
            
            const artistNameEl = document.createElement('p');
            artistNameEl.textContent = artistName;
            
            songInfo.appendChild(songNameEl);
            songInfo.appendChild(artistNameEl);
            
            box.appendChild(songInfo);
            
            if (trackData && trackData.track_id) {
                const embedContainer = document.createElement('div');
                embedContainer.className = 'spotify-embed';
                embedContainer.innerHTML = `
                    <iframe style="border-radius:12px" 
                        src="https://open.spotify.com/embed/track/${trackData.track_id}?utm_source=generator" 
                        width="100%" height="152" frameBorder="0" 
                        allowfullscreen="" 
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                        loading="lazy">
                    </iframe>
                `;
                box.appendChild(embedContainer);
            }
            
            recommendationsContainer.appendChild(box);
        });
    }
}

function findTrackData(trackName, artistName) {
    return trackData.find(track => 
        track.track_name === trackName && 
        track.artists === artistName
    );
}

fetch(url)
    .then(response => response.text())
    .then(csvText => {
        Papa.parse(csvText, {
            header: true,
            complete: function (results) {
                trackData = results.data;

                if (trackData && trackData.length > 0) {
                    displayTrackInfo(trackData[0]);
                } else {
                    const trackInfoContainer = document.getElementById('track-info');
                    const errorMessage = document.createElement('p');
                    errorMessage.textContent = "No track data found.";
                    errorMessage.style.color = "red";
                    trackInfoContainer.appendChild(errorMessage);
                }
            },
            error: function (error) {
                console.error("Papa Parse error:", error);
                const trackInfoContainer = document.getElementById('track-info');
                const errorMessage = document.createElement('p');
                errorMessage.textContent = "Failed to parse CSV data.";
                errorMessage.style.color = "red";
                trackInfoContainer.appendChild(errorMessage);
            }
        });
    })
    .catch(error => {
        console.error("Fetch error:", error);
        const errorMessage = document.createElement('p');
        errorMessage.textContent = "Failed to load CSV file.";
        errorMessage.style.color = "red";
        const trackInfoContainer = document.getElementById('track-info');
        trackInfoContainer.appendChild(errorMessage);
    });

function autocompleteTracks() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const searchResultsContainer = document.getElementById('search-results');
    searchResultsContainer.innerHTML = '';

    if (!searchTerm) {
        searchResultsContainer.style.display = 'none';
        return;
    }

    const results = trackData.filter(track => {
        if (track && track.track_name) {
            return track.track_name.toLowerCase().includes(searchTerm);
        }
        return false;
    });

    if (results.length > 0) {
        results.slice(0, 5).forEach(track => {
            const resultDiv = document.createElement('div');
            resultDiv.textContent = `${track.track_name} - ${track.artists}`;
            resultDiv.addEventListener('click', () => {
                document.getElementById('search-input').value = track.track_name;
                searchResultsContainer.style.display = 'none';
            });
            searchResultsContainer.appendChild(resultDiv);
        });
        searchResultsContainer.style.display = 'block';
    } else {
        searchResultsContainer.style.display = 'none';
    }
}

function performSearch() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const selectedTrack = trackData.find(track => track.track_name.toLowerCase() === searchTerm);
    const distanceMetric = document.getElementById('distance-selector').value;

    if (selectedTrack) {
        displayTrackInfo(selectedTrack);
        recommend(trackData, selectedTrack.track_name, selectedTrack.artists, 6, distanceMetric)
            .then(recommendations => {
                displayRecommendations(recommendations, distanceMetric);
            })
            .catch(error => {
                console.error("Recommendation error:", error);
                displayRecommendations("Error generating recommendations.");
            });
    } else {
        displayTrackInfo(null);
        displayRecommendations("Track not found.");
    }
}

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        magnitudeA += Math.pow(vecA[i], 2);
        magnitudeB += Math.pow(vecB[i], 2);
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
}

function euclideanDistance(vecA, vecB) {
    let sumOfSquares = 0;

    for (let i = 0; i < vecA.length; i++) {
        sumOfSquares += Math.pow(vecA[i] - vecB[i], 2);
    }

    return Math.sqrt(sumOfSquares);
}
