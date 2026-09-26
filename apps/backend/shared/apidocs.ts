const apiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Stackit API",
    version: "1.0.0",
    description: "API for the Stackit Trello clone.",
  },
  servers: [
    { url: "http://localhost:3000", description: "Local development server" },
  ],
  tags: [
    { name: "Health", description: "Service health checks" },
    { name: "Authentication", description: "Account registration and sign-in" },
    { name: "Organizations", description: "Organization management" },
    {
      name: "Memberships",
      description: "Organization invitations and members",
    },
    { name: "Boards", description: "Board management" },
    { name: "Sections", description: "Board list management" },
    { name: "Issues", description: "Card management" },
    { name: "Comments", description: "Issue comments" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Check API health",
        responses: {
          "200": {
            description: "API is running",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },
    "/health/db": {
      get: {
        tags: ["Health"],
        summary: "Check database health",
        responses: {
          "200": {
            description: "Database is available",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
          "500": { $ref: "#/components/responses/ServerError" },
        },
      },
    },
    "/api/v1/signup": {
      post: {
        tags: ["Authentication"],
        summary: "Create a user account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SignupRequest" },
            },
          },
        },
        responses: {
          "200": { $ref: "#/components/responses/SuccessResponse" },
          "400": { $ref: "#/components/responses/BadRequest" },
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
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/api/v1/organization/create": {
      post: {
        tags: ["Organizations"],
        security: [{ bearerAuth: [] }],
        summary: "Create an organization",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OrganizationRequest" },
            },
          },
        },
        responses: {
          "200": { $ref: "#/components/responses/OrganizationResponse" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/v1/organization": {
      get: {
        tags: ["Organizations"],
        security: [{ bearerAuth: [] }],
        summary: "List the current user's organizations",
        responses: {
          "200": { description: "Organizations returned" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/v1/organization/{orgId}": {
      parameters: [{ $ref: "#/components/parameters/OrgId" }],
      get: {
        tags: ["Organizations"],
        security: [{ bearerAuth: [] }],
        summary: "Get an organization membership",
        responses: {
          "200": { description: "Organization returned" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      put: {
        tags: ["Organizations"],
        security: [{ bearerAuth: [] }],
        summary: "Update an organization",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/OrganizationUpdateRequest",
              },
            },
          },
        },
        responses: {
          "200": { $ref: "#/components/responses/OrganizationResponse" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      delete: {
        tags: ["Organizations"],
        security: [{ bearerAuth: [] }],
        summary: "Delete an organization",
        responses: {
          "200": { $ref: "#/components/responses/SuccessResponse" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/v1/invite": {
      post: {
        tags: ["Memberships"],
        security: [{ bearerAuth: [] }],
        summary: "Invite a user to an organization",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InvitationRequest" },
            },
          },
        },
        responses: {
          "200": { $ref: "#/components/responses/SuccessResponse" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/v1/accept/{inviteId}": {
      parameters: [{ $ref: "#/components/parameters/InviteId" }],
      post: {
        tags: ["Memberships"],
        security: [{ bearerAuth: [] }],
        summary: "Accept an organization invitation",
        responses: {
          "200": { $ref: "#/components/responses/SuccessResponse" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/membership/{orgId}": {
      parameters: [{ $ref: "#/components/parameters/OrgId" }],
      get: {
        tags: ["Memberships"],
        security: [{ bearerAuth: [] }],
        summary: "List organization members",
        responses: {
          "200": { description: "Members returned" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/v1/membership/{userId}/{orgId}": {
      parameters: [
        { $ref: "#/components/parameters/UserId" },
        { $ref: "#/components/parameters/OrgId" },
      ],
      delete: {
        tags: ["Memberships"],
        security: [{ bearerAuth: [] }],
        summary: "Remove a member from an organization",
        responses: {
          "200": { $ref: "#/components/responses/SuccessResponse" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/boards": {
      get: {
        tags: ["Boards"],
        security: [{ bearerAuth: [] }],
        summary: "List boards in an organization",
        parameters: [{ $ref: "#/components/parameters/OrgIdQuery" }],
        responses: {
          "200": { description: "Boards returned" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Boards"],
        security: [{ bearerAuth: [] }],
        summary: "Create a board",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BoardRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Board created" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/v1/boards/{boardId}": {
      parameters: [{ $ref: "#/components/parameters/BoardId" }],
      put: {
        tags: ["Boards"],
        security: [{ bearerAuth: [] }],
        summary: "Update a board",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BoardUpdateRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Board updated" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Boards"],
        security: [{ bearerAuth: [] }],
        summary: "Delete a board",
        responses: {
          "200": { $ref: "#/components/responses/SuccessResponse" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/section": {
      get: {
        tags: ["Sections"],
        security: [{ bearerAuth: [] }],
        summary: "List sections in an organization",
        parameters: [{ $ref: "#/components/parameters/OrgIdQuery" }],
        responses: {
          "200": { description: "Sections returned" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
      post: {
        tags: ["Sections"],
        security: [{ bearerAuth: [] }],
        summary: "Create a section",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SectionRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Section created" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/section/{sectionId}": {
      parameters: [{ $ref: "#/components/parameters/SectionId" }],
      put: {
        tags: ["Sections"],
        security: [{ bearerAuth: [] }],
        summary: "Update a section",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SectionUpdateRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Section updated" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Sections"],
        security: [{ bearerAuth: [] }],
        summary: "Delete a section",
        responses: {
          "200": { $ref: "#/components/responses/SuccessResponse" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/issue/{sectionId}": {
      parameters: [{ $ref: "#/components/parameters/SectionId" }],
      post: {
        tags: ["Issues"],
        security: [{ bearerAuth: [] }],
        summary: "Create an issue",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/IssueRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Issue created" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
      get: {
        tags: ["Issues"],
        security: [{ bearerAuth: [] }],
        summary: "List issues in a section",
        responses: {
          "200": { description: "Issues returned" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/v1/issue/{issueId}": {
      parameters: [{ $ref: "#/components/parameters/IssueId" }],
      get: {
        tags: ["Issues"],
        security: [{ bearerAuth: [] }],
        summary: "Get an issue",
        responses: {
          "200": { description: "Issue returned" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
      put: {
        tags: ["Issues"],
        security: [{ bearerAuth: [] }],
        summary: "Update an issue",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/IssueUpdateRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Issue updated" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
      delete: {
        tags: ["Issues"],
        security: [{ bearerAuth: [] }],
        summary: "Delete an issue",
        responses: {
          "200": { $ref: "#/components/responses/SuccessResponse" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/v1/issue/move/{issueId}/{sectionId}": {
      parameters: [
        { $ref: "#/components/parameters/IssueId" },
        { $ref: "#/components/parameters/SectionId" },
      ],
      put: {
        tags: ["Issues"],
        security: [{ bearerAuth: [] }],
        summary: "Move an issue to another section",
        responses: {
          "200": { description: "Issue moved" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/comment/{issueId}": {
      parameters: [{ $ref: "#/components/parameters/IssueId" }],
      post: {
        tags: ["Comments"],
        security: [{ bearerAuth: [] }],
        summary: "Create a comment",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CommentRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Comment created" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
      get: {
        tags: ["Comments"],
        security: [{ bearerAuth: [] }],
        summary: "List comments for an issue",
        responses: {
          "200": { description: "Comments returned" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/api/v1/comment/{commentId}": {
      parameters: [{ $ref: "#/components/parameters/CommentId" }],
      put: {
        tags: ["Comments"],
        security: [{ bearerAuth: [] }],
        summary: "Update a comment",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CommentRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Comment updated" },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
      delete: {
        tags: ["Comments"],
        security: [{ bearerAuth: [] }],
        summary: "Delete a comment",
        responses: {
          "200": { $ref: "#/components/responses/SuccessResponse" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    parameters: {
      OrgId: {
        name: "orgId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      OrgIdQuery: {
        name: "orgId",
        in: "query",
        required: true,
        schema: { type: "string" },
      },
      InviteId: {
        name: "inviteId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      UserId: {
        name: "userId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      BoardId: {
        name: "boardId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      SectionId: {
        name: "sectionId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      IssueId: {
        name: "issueId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
      CommentId: {
        name: "commentId",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
    },
    responses: {
      BadRequest: {
        description: "Invalid request",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      Unauthorized: {
        description: "Missing or invalid JWT",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      Forbidden: {
        description: "User is not authorized for this resource",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      ServerError: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
          },
        },
      },
      SuccessResponse: {
        description: "Operation succeeded",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SuccessResponse" },
          },
        },
      },
      OrganizationResponse: {
        description: "Organization returned",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/OrganizationResponse" },
          },
        },
      },
    },
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
      OrganizationRequest: {
        type: "object",
        required: ["name", "description"],
        properties: {
          name: { type: "string", minLength: 1 },
          description: { type: "string" },
        },
      },
      OrganizationUpdateRequest: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1 },
          description: { type: "string" },
        },
      },
      InvitationRequest: {
        type: "object",
        required: ["email", "orgId"],
        properties: {
          email: { type: "string", format: "email" },
          orgId: { type: "string" },
        },
      },
      BoardRequest: {
        type: "object",
        required: ["title", "orgId"],
        properties: {
          title: { type: "string", minLength: 1 },
          orgId: { type: "string" },
        },
      },
      BoardUpdateRequest: {
        type: "object",
        required: ["title"],
        properties: { title: { type: "string", minLength: 1 } },
      },
      SectionRequest: {
        type: "object",
        required: ["title", "boardId"],
        properties: {
          title: { type: "string", minLength: 1 },
          boardId: { type: "string" },
        },
      },
      SectionUpdateRequest: {
        type: "object",
        required: ["title"],
        properties: { title: { type: "string", minLength: 1 } },
      },
      IssueRequest: {
        type: "object",
        required: ["title", "description"],
        properties: {
          title: { type: "string", minLength: 1 },
          description: { type: "string" },
        },
      },
      IssueUpdateRequest: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1 },
          description: { type: "string" },
        },
      },
      CommentRequest: {
        type: "object",
        required: ["comment"],
        properties: { comment: { type: "string", minLength: 1 } },
      },
      HealthResponse: {
        type: "object",
        properties: { status: { type: "string", example: "ok" } },
      },
      SuccessResponse: {
        type: "object",
        required: ["success"],
        properties: {
          success: { type: "boolean", example: true },
          msg: { type: "string" },
          data: {},
        },
      },
      SigninResponse: {
        type: "object",
        required: ["success", "data"],
        properties: {
          success: { type: "boolean", example: true },
          data: { type: "string", description: "JWT access token" },
          msg: { type: "string" },
        },
      },
      OrganizationResponse: {
        type: "object",
        required: ["success", "data"],
        properties: {
          success: { type: "boolean", example: true },
          data: { type: "object" },
          msg: { type: "string" },
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
