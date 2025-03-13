const url = 'spotify_tracks_dataset.csv';
let trackData = [];
let selectedColumns = ['danceability', 'energy', 'loudness', 'mode', 'speechiness', 'acousticness', 'instrumentalness', 'liveness', 'valence'];
const availableColumns = ['popularity', 'duration_ms', 'explicit', 'danceability', 'energy', 'key', 'loudness', 'mode', 'speechiness', 'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo', 'time_signature'];

function initColumnSelector() {
    const columnsList = document.querySelector('.columns-list');
    columnsList.innerHTML = '';
    
    availableColumns.forEach(column => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'column-checkbox';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `column-${column}`;
        checkbox.value = column;
        checkbox.checked = selectedColumns.includes(column);
        
        const label = document.createElement('label');
        label.htmlFor = `column-${column}`;
        label.textContent = column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        checkboxDiv.appendChild(checkbox);
        checkboxDiv.appendChild(label);
        columnsList.appendChild(checkboxDiv);
    });
    
    document.getElementById('columns-selector-button').addEventListener('click', (event) => {
        event.stopPropagation();
        document.getElementById('columns-dropdown').classList.toggle('show');
    });
    
    document.getElementById('select-all-columns').addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.column-checkbox input');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = !allChecked;
        });
    });
    
    document.getElementById('apply-columns').addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.column-checkbox input:checked');
        selectedColumns = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedColumns.length === 0) {
            alert('Please select at least one feature for comparison.');
            return;
        }
        
        document.getElementById('columns-dropdown').classList.remove('show');
        
        // Re-run search if there's a selected track
        if (document.getElementById('search-input').dataset.trackName) {
            performSearch();
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
        const dropdown = document.getElementById('columns-dropdown');
        const button = document.getElementById('columns-selector-button');
        
        if (!dropdown.contains(event.target) && event.target !== button) {
            dropdown.classList.remove('show');
        }
    });
}


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
    if (selectedColumns.length === 0) {
        return "Please select at least one feature for comparison.";
    }
    
    const songSearchArr = df.filter(song => song.track_name === songName && song.artists === artistName);

    if (songSearchArr.length === 0) {
        return "Song not found in the dataframe.";
    }

    const songSearch = selectedColumns.map(col => {
        const value = songSearchArr[0][col];
        return isNaN(parseFloat(value)) ? value : parseFloat(value);
    });

    const songNames = df.map(song => song.track_name);
    const songArtists = df.map(song => song.artists);

    const distances = df.map(song => {
        const features = selectedColumns.map(col => {
            const value = song[col];
            return isNaN(parseFloat(value)) ? value : parseFloat(value);
        });
        
        switch(distance) {
            case 'cosine':
                return 1 - cosineSimilarity(songSearch, features);
            case 'euclidean':
                return euclideanDistance(songSearch, features);
            case 'manhattan':
                return manhattanDistance(songSearch, features);
            case 'l3':
                return l3Distance(songSearch, features);
            case 'l4':
                return l4Distance(songSearch, features);
            default:
                return Infinity;
        }
    });

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
    return uniqueSongs.slice(0, nRecs);
}


function displayRecommendations(recommendations, metric) {
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
                trackData = results.data.filter(track =>
                    track.popularity && parseFloat(track.popularity) > 50
                );

                if (trackData && trackData.length > 0) {
                    displayTrackInfo(trackData[0]);
                    initColumnSelector(); // Initialize column selector
                } else {
                    const trackInfoContainer = document.getElementById('track-info');
                    const errorMessage = document.createElement('p');
                    errorMessage.textContent = "No track data with popularity over 50 found.";
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
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    const searchResultsContainer = document.getElementById('search-results');
    searchResultsContainer.innerHTML = '';

    if (!searchTerm) {
        searchResultsContainer.style.display = 'none';
        return;
    }

    const results = trackData.filter(track => {
        if (!track || !track.track_name || !track.artists) return false;

        const trackNameLower = track.track_name.toLowerCase();
        const artistNameLower = track.artists.toLowerCase();
        const combinedLower = `${trackNameLower} - ${artistNameLower}`;

        return trackNameLower.includes(searchTerm) ||
            artistNameLower.includes(searchTerm) ||
            combinedLower.includes(searchTerm);
    });

    results.sort((a, b) => {
        const aTrackMatch = a.track_name.toLowerCase().includes(searchTerm);
        const aArtistMatch = a.artists.toLowerCase().includes(searchTerm);
        const bTrackMatch = b.track_name.toLowerCase().includes(searchTerm);
        const bArtistMatch = b.artists.toLowerCase().includes(searchTerm);

        if (a.track_name.toLowerCase() === searchTerm && b.track_name.toLowerCase() !== searchTerm) return -1;
        if (b.track_name.toLowerCase() === searchTerm && a.track_name.toLowerCase() !== searchTerm) return 1;

        if (a.artists.toLowerCase() === searchTerm && b.artists.toLowerCase() !== searchTerm) return -1;
        if (b.artists.toLowerCase() === searchTerm && a.artists.toLowerCase() !== searchTerm) return 1;

        if (aTrackMatch && aArtistMatch && !(bTrackMatch && bArtistMatch)) return -1;
        if (bTrackMatch && bArtistMatch && !(aTrackMatch && aArtistMatch)) return 1;

        return 0;
    });

    if (results.length > 0) {
        results.slice(0, 8).forEach(track => {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'autocomplete-result';
            resultDiv.textContent = `${track.track_name} - ${track.artists}`;

            resultDiv.addEventListener('click', () => {
                const searchInput = document.getElementById('search-input');
                searchInput.value = `${track.track_name} - ${track.artists}`;
                searchInput.dataset.trackName = track.track_name;
                searchInput.dataset.artistName = track.artists;
                searchResultsContainer.style.display = 'none';

                performSearch();
            });

            searchResultsContainer.appendChild(resultDiv);
        });

        searchResultsContainer.style.display = 'block';
    } else {
        const noResultsDiv = document.createElement('div');
        noResultsDiv.className = 'no-results';
        noResultsDiv.textContent = 'No matching tracks found';
        searchResultsContainer.appendChild(noResultsDiv);
        searchResultsContainer.style.display = 'block';
    }
}

function performSearch() {
    const searchInput = document.getElementById('search-input');
    const distanceMetric = document.getElementById('distance-selector').value;

    let selectedTrack = null;

    if (searchInput.dataset.trackName && searchInput.dataset.artistName) {
        selectedTrack = trackData.find(track =>
            track.track_name === searchInput.dataset.trackName &&
            track.artists === searchInput.dataset.artistName
        );
    }

    if (!selectedTrack) {
        const inputValue = searchInput.value.trim();

        if (inputValue.includes(' - ')) {
            const parts = inputValue.split(' - ');
            if (parts.length === 2) {
                const trackName = parts[0].trim();
                const artistName = parts[1].trim();

                selectedTrack = trackData.find(track =>
                    track.track_name.toLowerCase() === trackName.toLowerCase() &&
                    track.artists.toLowerCase() === artistName.toLowerCase()
                );
            }
        }

        if (!selectedTrack) {
            const lowerInput = inputValue.toLowerCase();
            selectedTrack = trackData.find(track =>
                track.track_name.toLowerCase() === lowerInput
            );
        }

        if (!selectedTrack) {
            const lowerInput = inputValue.toLowerCase();
            selectedTrack = trackData.find(track =>
                track.artists.toLowerCase() === lowerInput
            );
        }
    }

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

function manhattanDistance(vecA, vecB) {
    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
        sum += Math.abs(vecA[i] - vecB[i]);
    }
    return sum;
}

function l3Distance(vecA, vecB) {
    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
        sum += Math.pow(Math.abs(vecA[i] - vecB[i]), 3);
    }
    return Math.pow(sum, 1 / 3);
}

function l4Distance(vecA, vecB) {
    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
        sum += Math.pow(Math.abs(vecA[i] - vecB[i]), 4);
    }
    return Math.pow(sum, 1 / 4);
}

document.getElementById('distance-selector').addEventListener('change', performSearch);
