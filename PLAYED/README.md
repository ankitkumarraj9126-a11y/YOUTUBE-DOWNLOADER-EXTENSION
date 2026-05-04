# JioSaavn API - FastAPI Version

This is a modern, high-performance "better version" rewrite of the JioSaavnAPI using **FastAPI**. It extracts data from JioSaavn such as song details, albums, playlists, and lyrics.

## Enhancements over original
- **FastAPI Framework**: Faster, asynchronous, and provides automatic interactive API documentation.
- **Type Hints**: Added Python type hints to functions for better clarity and IDE support.
- **Error Handling**: Native structured HTTP exceptions via FastAPI, replacing messy raw JSON string returns.
- **Clean Structure**: Easier to read and expand.

## How to run locally

1. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the Uvicorn server:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 5100
   ```

3. Visit your API documentation:
   - **Swagger UI**: [http://localhost:5100/docs](http://localhost:5100/docs)
   - **ReDoc**: [http://localhost:5100/redoc](http://localhost:5100/redoc)

## Features
- Search for songs by query or URL
- Fetch detailed metadata and streamable media URLs
- Support for fetching Playlists and Albums directly
- Lyrics extraction
