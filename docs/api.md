# OpenMail API

OpenMail API endpoints are protected by user API keys. Create and revoke keys from `/settings/apikey`.

## Authentication

Send the API key in either header:

```http
Authorization: Bearer om_xxx
```

```http
x-api-key: om_xxx
```

Missing or invalid keys return `401`.

## List Email Metadata

```http
GET /api/mail?email=user@example.com&page=1&pageSize=50
```

Returns paginated inbound email metadata for an email address linked to the API key owner. This endpoint does not return full email body content. Use `GET /api/mail/{id}` for the parsed body.

Query parameters:

- `email` required linked email address.
- `page` optional, defaults to `1`.
- `pageSize` optional, defaults to `50`, maximum `100`.

Response:

```json
{
	"data": [
		{
			"id": "email-id",
			"messageId": "<message@example.com>",
			"from": "sender@example.com",
			"to": "user@example.com",
			"subject": "Welcome",
			"receivedAt": "2026-06-17T10:00:00.000Z",
			"sizeBytes": 12345,
			"snippet": "Short preview text",
			"starred": false,
			"deleted": false,
			"read": false,
			"verificationCode": null,
			"summary": "A short summary.",
			"category": "Updates"
		}
	],
	"pagination": {
		"page": 1,
		"pageSize": 50,
		"total": 1,
		"totalPages": 1
	}
}
```

## Get Email Content

```http
GET /api/mail/{id}
```

Returns metadata plus parsed email content for a single inbound email owned by the API key user.

Response:

```json
{
	"id": "email-id",
	"messageId": "<message@example.com>",
	"from": "sender@example.com",
	"to": "user@example.com",
	"subject": "Welcome",
	"receivedAt": "2026-06-17T10:00:00.000Z",
	"sizeBytes": 12345,
	"snippet": "Short preview text",
	"starred": false,
	"deleted": false,
	"read": false,
	"verificationCode": null,
	"summary": "A short summary.",
	"category": "Updates",
	"content": {
		"text": "Plain text body",
		"html": "<p>HTML body</p>"
	}
}
```

## Link Email Address

```http
POST /api/email-addresses
Content-Type: application/json
```

Request:

```json
{
	"emailAddress": "user@example.com"
}
```

Links a receiving address to the API key owner. The same uniqueness and quota policy as `/settings/accounts` applies.

Response:

```json
{
	"emailAddress": "user@example.com"
}
```

## Unlink Email Address

```http
DELETE /api/email-addresses
Content-Type: application/json
```

Request:

```json
{
	"emailAddress": "user@example.com"
}
```

Unlinks a receiving address from the API key owner.

Response:

```json
{
	"emailAddress": "user@example.com"
}
```

## Common Errors

- `400` invalid or missing request input.
- `401` missing or invalid API key.
- `404` linked email address or email message was not found for the API key user.
