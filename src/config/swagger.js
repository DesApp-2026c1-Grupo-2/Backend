import swaggerJSDoc from 'swagger-jsdoc';

/**
 * Configuración de OpenAPI 3 para la API de gestión de laboratorios.
 *
 * La especificación se arma a partir de:
 *  - Esta definición base (info, servidores, security schemes y componentes
 *    reutilizables).
 *  - Las anotaciones JSDoc `@swagger` presentes en los archivos de rutas
 *    (ver `apis`).
 *
 * Para documentar un endpoint nuevo, agregá un bloque `@swagger` arriba de la
 * ruta en el archivo `*Routes.js` correspondiente. Ver `edificioRoutes.js` y
 * `usuarioRoutes.js` como ejemplos.
 */
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API - Gestión de Laboratorios',
      version: '1.0.0',
      description:
        'API REST para la gestión de laboratorios universitarios: pedidos, ' +
        'inventario (items/lotes), equipos, reservas, actividades, ' +
        'edificios/laboratorios, usuarios y descartes.',
    },
    servers: [
      {
        url: 'http://localhost:{port}',
        description: 'Servidor local de desarrollo',
        variables: {
          port: { default: process.env.PORT || '3000' },
        },
      },
    ],
    components: {
      securitySchemes: {
        // La autenticación es JWT vía header `Authorization: Bearer <token>`.
        // Se obtiene del endpoint POST /usuarios/login.
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Recurso no encontrado' },
            error: {
              type: 'string',
              example: 'Detalle técnico del error (opcional)',
            },
          },
        },
        Edificio: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            nombre: { type: 'string', example: 'Edificio de Ingeniería' },
            direccion: { type: 'string', example: 'Av. Siempre Viva 742' },
            estado: {
              type: 'boolean',
              description: 'false indica borrado lógico',
              example: true,
            },
            cantidadLaboratorios: {
              type: 'integer',
              description: 'Cantidad de laboratorios activos (virtual)',
              example: 3,
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        EdificioInput: {
          type: 'object',
          required: ['nombre', 'direccion'],
          properties: {
            nombre: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              example: 'Edificio de Ingeniería',
            },
            direccion: {
              type: 'string',
              maxLength: 200,
              example: 'Av. Siempre Viva 742',
            },
          },
        },
        Usuario: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            nombre: { type: 'string', example: 'Ada' },
            apellido: { type: 'string', example: 'Lovelace' },
            email: {
              type: 'string',
              format: 'email',
              example: 'ada@universidad.edu',
            },
            legajo: { type: 'string', example: '12345' },
            rol: {
              type: 'string',
              enum: ['DOCENTE', 'PERSONAL', 'ADMIN'],
              example: 'DOCENTE',
            },
            estado: {
              type: 'string',
              enum: ['ACTIVO', 'PENDIENTE', 'SUSPENDIDO'],
              example: 'ACTIVO',
            },
            activo: {
              type: 'boolean',
              description: 'false indica borrado lógico',
              example: true,
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        LoginInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'ada@universidad.edu',
            },
            password: { type: 'string', format: 'password', example: 'secreto123' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Login exitoso' },
            usuario: { $ref: '#/components/schemas/Usuario' },
            token: {
              type: 'string',
              description: 'JWT a usar en el header Authorization',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
          },
        },
      },
    },
    tags: [
      { name: 'Edificios', description: 'Gestión de edificios' },
      { name: 'Usuarios', description: 'Gestión de usuarios y autenticación' },
    ],
  },
  // Archivos donde swagger-jsdoc buscará anotaciones @swagger.
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
