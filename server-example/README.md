# Anonymous Edit Server

This is a reference implementation for handling anonymous wiki edits securely using an **Express server** (real-time mode).

> **📚 New here? Start with [ANONYMOUS_EDITS_OVERVIEW.md](./ANONYMOUS_EDITS_OVERVIEW.md)**
>
> **Two modes available:**
> - **🌟 Serverless** (Recommended): No server needed, zero cost → [SERVERLESS_SETUP.md](./SERVERLESS_SETUP.md)
> - **🚀 Server** (This guide): Real-time response, custom features → Continue below
>
> **Not sure?** See [CHOOSING_MODE.md](./CHOOSING_MODE.md)

---

## ⚠️ Security Warnings

**CRITICAL:**
- **NEVER** expose the bot's GitHub token to the client
- Store `BOT_GITHUB_TOKEN` in environment variables only
- Use fine-grained tokens with minimal permissions (repo scope only)
- Validate and sanitize all incoming data
- Rate limit requests by IP address
- Consider adding CAPTCHA for additional protection
- Log all anonymous contributions for moderation review

## Prerequisites

- Node.js 16+ installed
- A GitHub bot account (or dedicated service account)
- GitHub Personal Access Token with `repo` scope

## Setup

### 1. Create Bot Account

1. Create a new GitHub account for your bot (e.g., `yourwiki-bot`)
2. Go to Settings → Developer settings → Personal access tokens → Fine-grained tokens
3. Click "Generate new token"
4. Give it a name: "Wiki Anonymous Edits"
5. Set expiration (recommend 90 days, then rotate)
6. Select repository access: Only select repositories → Choose your wiki repo
7. Permissions → Repository permissions:
   - Contents: Read and write
   - Pull requests: Read and write
8. Click "Generate token" and copy it

### 2. Add Bot as Collaborator

Add your bot account as a collaborator to your wiki repository with **write** access:

```
Repository Settings → Collaborators → Add people → @yourwiki-bot
```

The bot needs write access to create branches and PRs on your main repository.

### 3. Install Dependencies

```bash
cd server-example
npm install
```

### 4. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
BOT_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx
REPO_OWNER=YourUsername
REPO_NAME=YourWikiRepo
BASE_BRANCH=main
PORT=3001
ALLOWED_ORIGIN=http://localhost:5173
ATTRIBUTION_FORMAT=Contributed anonymously via wiki editor
```

### 5. Update Wiki Config

In your `wiki-config.json`, enable anonymous mode:

```json
{
  "features": {
    "editRequestCreator": {
      "mode": "auto",
      "anonymous": {
        "enabled": true,
        "serverEndpoint": "http://localhost:3001/api/anonymous-edit",
        "attributionFormat": "Contributed anonymously via wiki editor"
      },
      "permissions": {
        "requireAuth": false
      }
    }
  }
}
```

## Running the Server

### Development

```bash
npm run dev
```

Server will start on `http://localhost:3001` with auto-reload.

### Production

```bash
npm start
```

## API Endpoints

### POST /api/anonymous-edit

Submit an anonymous edit request.

**Request Body:**
```json
{
  "section": "getting-started",
  "pageId": "first-steps",
  "content": "markdown content...",
  "editSummary": "Fixed typo in introduction",
  "filePath": "content/getting-started/first-steps.md",
  "metadata": {
    "id": "first-steps",
    "title": "First Steps"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "prNumber": 123,
  "prUrl": "https://github.com/owner/repo/pull/123",
  "message": "Edit request created successfully"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid input",
  "details": ["Invalid section"]
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-13T10:30:00.000Z"
}
```

## Rate Limiting

Default rate limits:
- **5 requests per hour per IP address**
- Configurable in `anonymous-edit-server.js`

When rate limit is exceeded:
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later.",
  "retryAfter": 3600
}
```

## Security Features

### Input Validation
- Validates all required fields
- Checks data types
- Prevents path traversal attacks
- Limits content size (100KB max)

### Content Sanitization
- Removes `<script>` tags
- Removes `javascript:` protocols
- Removes inline event handlers
- Basic markdown sanitization

### Rate Limiting
- In-memory rate limiting by IP
- 5 requests per hour per IP
- Prevents spam and abuse

### CORS Protection
- Restricts origins (configurable)
- Only allows POST method
- Prevents unauthorized access

## Deployment

### Option 1: Node.js Server (VPS/Cloud)

1. Install Node.js on your server
2. Clone your repository
3. Copy `.env` file with production values
4. Install dependencies: `npm install`
5. Use PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start anonymous-edit-server.js --name wiki-anon-server
   pm2 save
   pm2 startup
   ```

### Option 2: Serverless (Vercel/Netlify Functions)

Convert to serverless function:
```javascript
// api/anonymous-edit.js
module.exports = async (req, res) => {
  // Same logic as POST /api/anonymous-edit
};
```

### Option 3: Docker Container

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "anonymous-edit-server.js"]
```

Build and run:
```bash
docker build -t wiki-anon-server .
docker run -p 3001:3001 --env-file .env wiki-anon-server
```

## Production Considerations

### 1. HTTPS
Always use HTTPS in production:
- Use nginx/Apache as reverse proxy with SSL
- Or use serverless platforms with built-in HTTPS

### 2. Environment Variables
- Use secrets manager (AWS Secrets Manager, Vercel Secrets, etc.)
- Never commit `.env` to git
- Rotate tokens regularly (every 90 days)

### 3. Enhanced Rate Limiting
Consider using Redis for distributed rate limiting:
```bash
npm install redis express-rate-limit rate-limit-redis
```

### 4. CAPTCHA
Add CAPTCHA protection:
```bash
npm install express-recaptcha
```

### 5. Logging
Add proper logging:
```bash
npm install winston
```

### 6. Monitoring
- Set up error monitoring (Sentry, LogRocket)
- Monitor rate limit hits
- Track failed authentication attempts
- Alert on suspicious activity

### 7. Moderation Queue
Consider implementing:
- All anonymous PRs start as "draft"
- Require manual approval before becoming regular PR
- Automated content scanning for spam/abuse

## Testing

Test the server with curl:

```bash
curl -X POST http://localhost:3001/api/anonymous-edit \
  -H "Content-Type: application/json" \
  -d '{
    "section": "test",
    "pageId": "test-page",
    "content": "# Test Page\n\nThis is a test.",
    "editSummary": "Testing anonymous edit",
    "filePath": "content/test/test-page.md",
    "metadata": {
      "id": "test-page",
      "title": "Test Page"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "prNumber": 42,
  "prUrl": "https://github.com/owner/repo/pull/42",
  "message": "Edit request created successfully"
}
```

## Troubleshooting

### "Authentication failed"
- Check `BOT_GITHUB_TOKEN` is correct
- Verify token has `repo` scope
- Check token hasn't expired

### "Resource not accessible by integration"
- Bot account needs write access to repository
- Add bot as collaborator with write permission

### "Rate limit exceeded"
- Wait for rate limit window to reset (1 hour)
- Check if bot account has higher rate limits
- Consider GitHub App for higher limits

### CORS errors
- Update `ALLOWED_ORIGIN` in `.env`
- Check frontend URL matches origin
- Verify CORS middleware configuration

## License

MIT
