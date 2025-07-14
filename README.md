# Acme Server - Multi-tenant Team Management & AI Chat Demo

A demonstration NestJS backend extracted from a work-in-progress multi-tenant SaaS application. This project showcases enterprise-grade architecture patterns for company/team management with an integrated AI chat module for EB-2 NIW (National Interest Waiver) immigration assistance.

## 🚀 Key Features

### Multi-tenant Architecture

- **Company Management**: Full multi-tenant isolation with company-based data segregation
- **Team Management**: Hierarchical team structures with role-based permissions
- **User Management**: JWT-based authentication with Auth0 integration
- **Access Control**: Granular permissions system (`resource:action:scope` pattern)

### AI-Powered Chat Module

- **LangChain Integration**: Advanced conversational AI for immigration document analysis
- **RAG Implementation**: Retrieval-Augmented Generation for accurate EB-2 NIW guidance
- **Document Processing**: Accepts and analyzes user documents (PDFs, text files)
- **Smart Evaluation**: Assesses eligibility and provides personalized recommendations
- **Context-Aware Responses**: Maintains conversation history for coherent interactions

## 🏗️ Architecture Overview

```
acme_server/
├── src/
│   ├── modules/
│   │   ├── auth/          # JWT authentication & Auth0 integration
│   │   ├── chat/          # LangChain-powered chat module
│   │   ├── company/       # Multi-tenant company management
│   │   ├── config/        # Client configuration management
│   │   ├── health/        # Health check endpoints
│   │   ├── role/          # Role & permissions management
│   │   ├── team/          # Team & member management
│   │   └── access-control/ # Business logic authorization
│   ├── core/              # Core infrastructure (guards, decorators)
│   ├── common/            # Shared utilities (DTOs, filters, interceptors)
│   ├── config/            # Database configuration
│   └── migrations/        # Database migration files
├── test/                  # Comprehensive test suites
├── config/                # Sequelize & deployment configuration
├── docs/                  # Documentation & guides
├── uploads/               # File upload storage
└── vector-store/          # RAG vector embeddings for chat
```

## 🛠️ Tech Stack

- **Framework**: NestJS (Node.js)
- **Database**: MySQL with Sequelize ORM
- **Authentication**: JWT with Auth0
- **AI/ML**: LangChain, Gemini, Vector Embeddings
- **Testing**: Jest (Unit, E2E, Integration tests)
- **Documentation**: Swagger/OpenAPI

## 📋 Prerequisites

- Node.js 18+
- MySQL 8.0+
- Auth0 account (for authentication)
- Google Gemini API key (for AI chat functionality)

## 🚀 Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/acme-server.git
   cd acme-server
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Run database migrations**

   ```bash
   npx sequelize-cli db:migrate
   ```

5. **Start the development server**

   ```bash
   npm run start:dev
   ```

6. **Access the API**
   - API Documentation: http://localhost:3000/api
   - Health Check: http://localhost:3000/health

## 🧪 Testing

```bash
# Run all tests
npm run test:all-slow

# Unit tests
npm test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode (TDD)
npm run test:watch
```

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Multi-tenant Isolation**: Strict company-based data separation
- **Permission Guards**: Granular access control with decorators
- **SQL Injection Protection**: Parameterized queries via Sequelize
- **Rate Limiting**: API throttling for DDoS protection
- **Audit Logging**: Comprehensive activity tracking

## 💬 Chat Module Features

The AI-powered chat module specializes in EB-2 NIW (Employment-Based Second Preference National Interest Waiver) immigration assistance:

- **Document Analysis**: Upload and analyze supporting documents
- **Eligibility Assessment**: Evaluate qualifications against NIW criteria
- **Personalized Guidance**: Tailored recommendations based on user profile
- **Multi-format Support**: Process PDFs, Word documents, and text files
- **Conversation Memory**: Maintains context across multiple interactions
- **RAG-Enhanced Accuracy**: Retrieves relevant immigration law information

## 🏢 Multi-tenant Features

- **Company Types**: Support for CLIENT, VENDOR, and PARTNER companies
- **Team Types**: LEGAL, BUSINESS, PRODUCT, and CUSTOM teams
- **Role-Based Access**: Owner, Admin, Manager, and Member roles
- **Permission Scopes**: Own, Assigned, Managed, and Any resource access
- **Audit Trail**: Complete history of all data modifications

## 📚 API Documentation

Once the server is running, visit http://localhost:3000/api for interactive Swagger documentation.

### Key Endpoints

#### Public Endpoints
- `POST /companies/register-vendor` - Register a new vendor company
- `GET /health` - Health check endpoint
- `GET /config` - Get client configuration

#### Authentication
- `POST /auth/signup` - Create a new user account
- `GET /auth/user` - Get authenticated user data
- `GET /users/me` - Get authenticated user profile

#### Company Management
- `GET /company` - Get current user's company info
- `GET /admin/companies` - List companies with filtering (admin only)
- `POST /companies/:companyId/users` - Add user to company
- `GET /companies/:companyId/users` - Get company users

#### Team Management
- `POST /teams` - Create a new team
- `GET /teams` - List teams with pagination
- `POST /teams/:teamId/members` - Add members to team
- `DELETE /teams/:teamId` - Delete a team

#### AI Chat
- `POST /chat/eb-2` - EB-2 NIW consultation with document analysis (handles both text questions and file uploads)

## 🤝 Contributing

This is a demonstration project extracted from a larger system. While not actively maintained for external contributions, feel free to fork and adapt for your own needs.

## 📄 License

This project is provided as-is for demonstration purposes. Please check with the repository owner for specific licensing terms.

## ⚠️ Disclaimer

This is a **demonstration project** extracted and cleaned from a work-in-progress application. It showcases architectural patterns and integration capabilities but may require additional configuration and security hardening for production use.

The EB-2 NIW chat functionality is for demonstration purposes only and should not be considered as legal advice. Always consult with qualified immigration attorneys for actual immigration matters.

## 🙏 Acknowledgments

- Built with [NestJS](https://nestjs.com/)
- AI capabilities powered by [LangChain](https://www.langchain.com/)
- Vector storage and RAG implementation for immigration document processing
