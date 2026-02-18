# Utilities Documentation

This directory contains utility modules that provide common functionality throughout the application.

## Modules

### logger.js
Centralized logging system with environment-aware behavior.

**Key Features:**
- Log levels: error, warn, info, debug
- Automatic log level based on environment
- Consistent formatting with timestamps
- Context-based logging
- Performance timing

**Example:**
```javascript
import { logger } from '@/utils/logger';

logger.info('MyComponent', 'User logged in');
logger.error('MyComponent', 'Failed to save', error);

const endTimer = logger.time('MyComponent', 'Data processing');
// ... do work ...
endTimer();
```

### errorHandler.js
Centralized error handling with custom error types.

**Key Features:**
- Custom AppError class
- Standard error types
- User-friendly error messages
- Retry logic with exponential backoff
- Error wrapping utilities

**Example:**
```javascript
import { handleError, AppError, ErrorType, retryWithBackoff } from '@/utils/errorHandler';

// Wrap errors
try {
  await riskyOperation();
} catch (error) {
  throw handleError(error, 'MyComponent');
}

// Create custom errors
throw new AppError('Invalid input', ErrorType.VALIDATION);

// Retry operations
const data = await retryWithBackoff(() => fetchData(), 3);
```

### http.js
HTTP client utilities with built-in error handling.

**Key Features:**
- GET/POST helpers
- Automatic error handling
- Progress tracking for downloads
- Retry logic
- JSON/text fetching

**Example:**
```javascript
import { get, fetchWithProgress } from '@/utils/http';

// Simple GET
const data = await get('/api/data');

// With progress tracking
const buffer = await fetchWithProgress('/data/large-file.bin', (loaded, total) => {
  console.log(`Progress: ${(loaded / total * 100).toFixed(0)}%`);
});
```

### config.js
Environment configuration helper.

**Key Features:**
- Type-safe environment variable access
- Application configuration
- Feature flags
- API URL helpers

**Example:**
```javascript
import { appConfig, getApiUrl, isFeatureEnabled } from '@/utils/config';

console.log(appConfig.apiUrl);
const endpoint = getApiUrl('/data/layers');

if (isFeatureEnabled('experimental_ui')) {
  // Show experimental UI
}
```

### performance.js
Performance monitoring utilities.

**Key Features:**
- Execution time measurement
- Metric collection and statistics
- Component render tracking
- Performance observer

**Example:**
```javascript
import { measure, recordMetric, getAllMetrics } from '@/utils/performance';

// Measure function execution
await measure('Data Processing', async () => {
  // ... do work ...
});

// Get all metrics
const stats = getAllMetrics();
```

### devTools.js
Development utilities and debugging helpers.

**Key Features:**
- Dev mode helpers via window.__histmap__
- Lifecycle logging
- Development assertions
- Deprecation warnings

**Example:**
```javascript
import { enableDevMode, logLifecycle, devAssert } from '@/utils/devTools';

// Enable in app initialization
enableDevMode();

// Log component lifecycle
logLifecycle('MyComponent', 'mounted', { props });

// Assert in development
devAssert(user !== null, 'User must be logged in');
```

## Usage Guidelines

### When to Use Each Utility

- **logger**: For all logging needs (replace console.log/warn/error)
- **errorHandler**: When catching and throwing errors
- **http**: For network requests
- **config**: For environment-specific configuration
- **performance**: To identify performance bottlenecks
- **devTools**: Only in development for debugging

### Best Practices

1. **Always use logger instead of console**
   ```javascript
   // ❌ Don't
   console.log('User clicked button');
   
   // ✅ Do
   logger.info('ButtonComponent', 'User clicked button');
   ```

2. **Provide context in logs**
   ```javascript
   // ❌ Don't
   logger.error('Error', 'Something failed');
   
   // ✅ Do
   logger.error('UserService', 'Failed to save user profile', { userId, error });
   ```

3. **Use AppError for application errors**
   ```javascript
   // ❌ Don't
   throw new Error('User not found');
   
   // ✅ Do
   throw new AppError('User not found', ErrorType.NOT_FOUND, { userId });
   ```

4. **Measure performance of heavy operations**
   ```javascript
   import { measure } from '@/utils/performance';
   
   const result = await measure('Large Dataset Processing', async () => {
     return processLargeDataset(data);
   });
   ```

5. **Check feature flags before using experimental features**
   ```javascript
   import { isFeatureEnabled } from '@/utils/config';
   
   if (isFeatureEnabled('new_renderer')) {
     useNewRenderer();
   } else {
     useOldRenderer();
   }
   ```

## Environment Variables

### Client (.env)
```bash
VITE_API_URL=http://localhost:3000
VITE_API_TIMEOUT=30000
VITE_ENABLE_DEBUG=false
VITE_ENABLE_PERFORMANCE=false
```

### Server (.env)
```bash
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:8080,http://localhost:5173
```

## Development Console Access

In development mode, utilities are accessible via browser console:

```javascript
// View performance metrics
__histmap__.getMetrics()

// Change log level
__histmap__.setLogLevel('debug')

// Get app info
__histmap__.getInfo()

// Reload config
__histmap__.reloadConfig()
```
