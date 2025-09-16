# SEC API Client

TypeScript client library for the FastAPI SEC Documents and Metadata server.

## Overview

This client provides a type-safe interface to interact with the SEC documents API server. It includes full TypeScript types for all API responses and convenient methods for common operations.

## Quick Start

```typescript
import { api } from '@/lib/api-client';

// Check server health
const health = await api.getHealth();

// Search companies by name
const companies = await api.getCompaniesByName('Apple', 10);

// Search by ticker symbol
const appleCompanies = await api.getCompaniesByTicker('AAPL');

// Get documents for a company
const documents = await api.getDocumentsByTicker('AAPL', 2019, 5);

// Full-text search in document content
const searchResults = await api.simpleSearch('revenue growth', 20);
```

## API Client Class

The `SECApiClient` class provides the main functionality:

```typescript
import { SECApiClient } from '@/lib/api-client';

const client = new SECApiClient('http://localhost:8000');
```

## Available Methods

### Server Status
- `api.getHealth()` - Check server and database health
- `api.getStats()` - Get database statistics
- `api.getInfo()` - Get server information

### Company Search
- `api.searchCompanies(params)` - Flexible company search
- `api.getCompaniesByName(name, limit?)` - Search by company name
- `api.getCompaniesByTicker(ticker, limit?)` - Search by ticker symbol
- `api.getCompanyByCik(cik)` - Get company by CIK number

### Document Search
- `api.searchDocuments(params)` - Flexible document search
- `api.getDocumentById(docId)` - Get document by ID
- `api.getDocumentsByTicker(ticker, year?, limit?)` - Get documents by ticker
- `api.getDocumentsByCik(cik, year?, limit?)` - Get documents by CIK

### Full-Text Search
- `api.searchFullText(params)` - Advanced full-text search
- `api.simpleSearch(query, limit?)` - Simple text search

## Types

All API response types are available:

```typescript
import type { 
  CompanyTickerExchange,
  DocumentMetadata,
  SearchResult,
  DatabaseStats 
} from '@/lib/api-client';
```

## Error Handling

The client throws descriptive errors that can be caught and handled:

```typescript
try {
  const companies = await api.getCompaniesByName('Apple');
} catch (error) {
  console.error('API Error:', error.message);
}
```

## Configuration

Default base URL is `http://localhost:8000`. To use a different server:

```typescript
import { SECApiClient } from '@/lib/api-client';

const client = new SECApiClient('https://your-api-server.com');
```

## Demo Usage

See the `SECApiDemo` component for a complete interactive example of all API functionality.
