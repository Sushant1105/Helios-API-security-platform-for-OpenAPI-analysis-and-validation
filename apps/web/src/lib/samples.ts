/**
 * Client-safe built-in sample OpenAPI specifications.
 * These are pure strings with zero Node standard library dependencies.
 */

export const ECOMMERCE_SAMPLE_YAML = `openapi: 3.1.0
info:
  title: Helios Commerce API
  version: 1.0.0
  description: High-throughput e-commerce platform microservice.
servers:
  - url: https://api.commerce.example.com/v1
    description: Production TLS Gateway
  - url: http://insecure.commerce.example.com/v1
    description: Insecure Legacy Staging Server
paths:
  /products:
    get:
      summary: List all products
      operationId: listProducts
      tags:
        - Products
      parameters:
        - name: category
          in: query
          required: false
          schema:
            type: string
      responses:
        '200':
          description: A list of products
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Product'
    post:
      summary: Create product
      operationId: createProduct
      tags:
        - Products
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProductInput'
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'
  /products/{id}:
    get:
      summary: Get product by ID
      operationId: getProductById
      tags:
        - Products
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Product details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'
        '404':
          description: Product not found
    delete:
      summary: Delete product
      operationId: deleteProduct
      tags:
        - Products
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: Product deleted
  /auth/login:
    post:
      summary: Authenticate user
      operationId: loginUser
      tags:
        - Authentication
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: Authentication tokens
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
  /admin/users:
    get:
      summary: Retrieve all user accounts
      operationId: getAdminUsers
      tags:
        - Administration
      responses:
        '200':
          description: List of user accounts
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/UserAccount'
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    ApiKeyQuery:
      type: apiKey
      name: api_key
      in: query
  schemas:
    Product:
      type: object
      required:
        - id
        - name
        - price
      properties:
        id:
          type: string
        name:
          type: string
        price:
          type: number
        description:
          type: string
    ProductInput:
      type: object
      required:
        - name
        - price
      properties:
        name:
          type: string
        price:
          type: number
        description:
          type: string
    LoginRequest:
      type: object
      required:
        - email
        - password
      properties:
        email:
          type: string
        password:
          type: string
    AuthResponse:
      type: object
      required:
        - token
      properties:
        token:
          type: string
        refreshToken:
          type: string
        expiresIn:
          type: integer
    UserAccount:
      type: object
      required:
        - id
        - email
      properties:
        id:
          type: string
        email:
          type: string
        role:
          type: string
        passwordHash:
          type: string
`;

export const ECOMMERCE_V2_SAMPLE_YAML = `openapi: 3.1.0
info:
  title: Helios Commerce API
  version: 2.0.0
  description: High-throughput e-commerce platform microservice - Version 2.
servers:
  - url: https://api.commerce.example.com/v2
    description: Production TLS Gateway V2
paths:
  /products:
    get:
      summary: List all products (v2 with mandatory tenantId)
      operationId: listProducts
      tags:
        - Products
      parameters:
        - name: category
          in: query
          required: false
          schema:
            type: string
        - name: tenantId
          in: query
          required: true
          schema:
            type: string
      responses:
        '200':
          description: A list of products
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Product'
    post:
      summary: Create product
      operationId: createProduct
      tags:
        - Products
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProductInput'
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'
  /products/{id}:
    get:
      summary: Get product by ID
      operationId: getProductById
      tags:
        - Products
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Product details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'
        '404':
          description: Product not found
  /v2/orders:
    get:
      summary: List customer orders
      operationId: listOrders
      tags:
        - Orders
      security:
        - BearerAuth: []
      responses:
        '200':
          description: Order list
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    Product:
      type: object
      required:
        - id
        - name
        - price
      properties:
        id:
          type: string
        name:
          type: string
        price:
          type: number
    ProductInput:
      type: object
      required:
        - name
        - price
      properties:
        name:
          type: string
        price:
          type: number
`;

export const MINIMAL_SAMPLE_JSON = JSON.stringify(
  {
    openapi: '3.0.3',
    info: {
      title: 'Helios Health API',
      version: '1.0.0',
      description: 'Internal service health and metrics API.',
    },
    servers: [
      {
        url: 'https://health.example.com',
        description: 'Health Endpoint Gateway',
      },
    ],
    paths: {
      '/health': {
        get: {
          summary: 'Service Liveness Check',
          operationId: 'getHealth',
          tags: ['Health'],
          responses: {
            '200': {
              description: 'Service is operational',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['status', 'timestamp'],
                    properties: {
                      status: { type: 'string' },
                      timestamp: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  null,
  2
);
