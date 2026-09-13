const apiDocument = {
  api: "3.0.3",
  info: {
    title: "Stackit API",
    version: "1.0.0",
    description: "API for the Stackit.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development server",
    },
  ],
  tags: [
    {
      name: "Authentication",
      description: "Account registration and sign-in",
    },
  ],
  paths: {
    "/api/v1/signup": {
      post: {
        tags: ["Authentication"],
        summary: "Create a user account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SignupRequest" },
              example: {
                email: "alice@example.com",
                password: "password123",
                profile: "https://example.com/alice.jpg",
                description: "Product designer",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "User account created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SuccessResponse" },
              },
            },
          },
          "400": {
            description: "Invalid request or email already registered",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/signin": {
      post: {
        tags: ["Authentication"],
        summary: "Sign in to an account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SigninRequest" },
              example: {
                email: "alice@example.com",
                password: "password123",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "User signed in",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SigninResponse" },
              },
            },
          },
          "400": {
            description: "Invalid credentials or request",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      SignupRequest: {
        type: "object",
        required: ["email", "password", "profile", "description"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
          profile: { type: "string" },
          description: { type: "string" },
        },
      },
      SigninRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 1 },
        },
      },
      SuccessResponse: {
        type: "object",
        required: ["success", "msg"],
        properties: {
          success: { type: "boolean", example: true },
          msg: { type: "string", example: "SUCCESSFULLY_SIGNEDUP" },
        },
      },
      SigninResponse: {
        type: "object",
        required: ["success", "data", "msg"],
        properties: {
          success: { type: "boolean", example: true },
          data: { type: "string", description: "JWT access token" },
          msg: { type: "string", example: "USER_SUCCESSFULLY_SIGNEDIN" },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["success", "error"],
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string" },
        },
      },
    },
  },
} as const;

export default apiDocument;
