# audiomack-search-parser
Simple API to scrape and parse Audiomack search results using Playwright

## Usage
Send a GET request to `/search` with query parameters:

- `query` (string, required): search term  
- `limit` (number, optional): max results (default: 20)  

Add `Authorization: Bearer <token>` header if `API_TOKEN` is set.

### Example

```http
GET /search?query=Aya Nakamura&limit=10
Authorization: Bearer your_token_here
```

# Deploying
To deploy: 
```bash
npm install
```
then
```bash
npx playwright install firefox
```

And to start:
```bash
node app.js
```

Default port is 3000 (configurable via PORT environment variable).
If you want token protection, set API_TOKEN environment variable.