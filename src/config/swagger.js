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
        Laboratorio: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            nombre: { type: 'string', example: 'Laboratorio de Química 1' },
            edificioId: {
              type: 'string',
              description: 'ID del edificio al que pertenece',
              example: '665f1a2b3c4d5e6f7a8b9c0e',
            },
            capacidad: {
              type: 'integer',
              minimum: 1,
              example: 30,
            },
            tipo: {
              type: 'string',
              enum: ['biologia', 'quimica', 'mixto'],
              example: 'quimica',
            },
            estado: {
              type: 'string',
              enum: [
                'disponible',
                'en mantenimiento',
                'fuera de servicio',
                'eliminado',
              ],
              description: '"eliminado" indica borrado lógico',
              example: 'disponible',
            },
            equiposFijos: {
              type: 'array',
              description:
                'Equipos fijos del laboratorio (virtual; sólo presente ' +
                'en el listado por edificio, que usa populate).',
              items: {
                type: 'object',
                properties: {
                  nombre: { type: 'string', example: 'Campana extractora' },
                },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        LaboratorioInput: {
          type: 'object',
          required: ['nombre', 'edificioId', 'capacidad', 'tipo'],
          properties: {
            nombre: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              example: 'Laboratorio de Química 1',
            },
            edificioId: {
              type: 'string',
              description: 'ObjectId del edificio (24 caracteres hex)',
              example: '665f1a2b3c4d5e6f7a8b9c0e',
            },
            capacidad: {
              type: 'integer',
              minimum: 1,
              example: 30,
            },
            tipo: {
              type: 'string',
              enum: ['biologia', 'quimica', 'mixto'],
              example: 'quimica',
            },
            estado: {
              type: 'string',
              enum: ['disponible', 'en mantenimiento', 'fuera de servicio'],
              description: 'Opcional; por defecto "disponible"',
              example: 'disponible',
            },
          },
        },
        LaboratorioEstadoInput: {
          type: 'object',
          required: ['estado'],
          properties: {
            estado: {
              type: 'string',
              enum: ['disponible', 'en mantenimiento', 'fuera de servicio'],
              example: 'en mantenimiento',
            },
          },
        },
        Equipo: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            nombre: { type: 'string', example: 'Microscopio óptico' },
            codigo: {
              type: 'string',
              description: 'Código único del equipo',
              example: 'MIC-001',
            },
            tipo: { type: 'string', example: 'microscopio' },
            esFijo: {
              type: 'boolean',
              description:
                'true = equipo fijo (requiere laboratorioId); ' +
                'false = móvil (no debe tener laboratorioId).',
              example: false,
            },
            estado: {
              type: 'string',
              enum: ['disponible', 'mantenimiento', 'fuera de servicio'],
              example: 'disponible',
            },
            edificioId: {
              type: 'string',
              nullable: true,
              description: 'ID del edificio (o el edificio populado en las lecturas)',
              example: '665f1a2b3c4d5e6f7a8b9c0e',
            },
            laboratorioId: {
              type: 'string',
              nullable: true,
              description: 'ID del laboratorio (obligatorio si esFijo=true)',
              example: null,
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
        EquipoInput: {
          type: 'object',
          required: ['nombre', 'codigo', 'tipo', 'esFijo'],
          properties: {
            nombre: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              example: 'Microscopio óptico',
            },
            codigo: { type: 'string', example: 'MIC-001' },
            tipo: { type: 'string', example: 'microscopio' },
            esFijo: {
              type: 'boolean',
              description:
                'Si es true, laboratorioId es obligatorio; si es false, ' +
                'laboratorioId debe ser null u omitirse.',
              example: false,
            },
            estado: {
              type: 'string',
              enum: ['disponible', 'mantenimiento', 'fuera de servicio'],
              description: 'Opcional; por defecto "disponible"',
              example: 'disponible',
            },
            edificioId: {
              type: 'string',
              nullable: true,
              description: 'ObjectId (24 hex) o null',
              example: '665f1a2b3c4d5e6f7a8b9c0e',
            },
            laboratorioId: {
              type: 'string',
              nullable: true,
              description: 'ObjectId (24 hex) o null',
              example: null,
            },
          },
        },
        EquipoUpdateInput: {
          type: 'object',
          description:
            'Todos los campos son opcionales. La combinación esFijo/' +
            'laboratorioId debe seguir siendo coherente.',
          properties: {
            nombre: { type: 'string', minLength: 2, maxLength: 100 },
            codigo: { type: 'string' },
            tipo: { type: 'string' },
            esFijo: { type: 'boolean' },
            estado: {
              type: 'string',
              enum: ['disponible', 'mantenimiento', 'fuera de servicio'],
            },
            edificioId: { type: 'string', nullable: true },
            laboratorioId: { type: 'string', nullable: true },
            activo: { type: 'boolean' },
          },
        },
        HistorialMantenimiento: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0f' },
            equipoId: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            tipo: {
              type: 'string',
              enum: ['preventivo', 'correctivo'],
              example: 'preventivo',
            },
            descripcion: {
              type: 'string',
              nullable: true,
              example: 'Cambio de lámpara y limpieza de lentes',
            },
            fecha: {
              type: 'string',
              format: 'date-time',
              description: 'Momento de inicio del mantenimiento',
            },
            fin: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Momento de cierre; null mientras está abierto',
            },
            responsableId: {
              description:
                'ID del usuario que registró el mantenimiento, o el usuario ' +
                'populado (nombre, apellido, email, rol) en el listado.',
              oneOf: [
                { type: 'string' },
                { $ref: '#/components/schemas/Usuario' },
              ],
              nullable: true,
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        MantenimientoInput: {
          type: 'object',
          required: ['tipo'],
          properties: {
            tipo: {
              type: 'string',
              enum: ['preventivo', 'correctivo'],
              example: 'preventivo',
            },
            descripcion: {
              type: 'string',
              maxLength: 500,
              nullable: true,
              example: 'Cambio de lámpara y limpieza de lentes',
            },
            fecha: {
              type: 'string',
              format: 'date-time',
              description: 'Opcional; no puede ser futura. Por defecto, ahora.',
            },
          },
        },
        Item: {
          type: 'object',
          description:
            'Definición de un item de inventario (características generales). ' +
            'El stock físico se maneja a nivel de Lote.',
          properties: {
            id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            tipo: {
              type: 'string',
              enum: ['sustancia', 'reactivo', 'material'],
              example: 'reactivo',
            },
            nombre: { type: 'string', example: 'Ácido clorhídrico' },
            codigo: {
              type: 'string',
              description: 'Código único del item',
              example: 'RCT-HCL-01',
            },
            unidad: {
              type: 'string',
              description: 'Unidad de medida (g, ml, unidad, etc.)',
              example: 'ml',
            },
            esConsumible: { type: 'boolean', example: true },
            requiereReceta: {
              type: 'boolean',
              description: 'Sólo los items de tipo "reactivo" pueden requerir receta',
              example: true,
            },
            activo: {
              type: 'boolean',
              description: 'false indica borrado lógico',
              example: true,
            },
            stockDisponible: {
              type: 'number',
              description:
                'Stock disponible calculado sobre los lotes (presente en las ' +
                'lecturas; no es un campo persistido).',
              example: 500,
            },
            cantidadDisponible: {
              type: 'number',
              description:
                'Alias de stockDisponible por compatibilidad con el formulario ' +
                'de pedidos (sólo en el listado).',
              example: 500,
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ItemInput: {
          type: 'object',
          required: ['tipo', 'nombre', 'codigo', 'unidad', 'esConsumible'],
          properties: {
            tipo: {
              type: 'string',
              enum: ['sustancia', 'reactivo', 'material'],
              example: 'reactivo',
            },
            nombre: { type: 'string', example: 'Ácido clorhídrico' },
            codigo: { type: 'string', example: 'RCT-HCL-01' },
            unidad: { type: 'string', example: 'ml' },
            esConsumible: { type: 'boolean', example: true },
            requiereReceta: {
              type: 'boolean',
              description:
                'Opcional (default false). Sólo puede ser true si tipo = "reactivo".',
              example: true,
            },
          },
        },
        Lote: {
          type: 'object',
          description:
            'Unidad física de gestión de stock de un item (cantidad, ' +
            'ubicación y estado). Todas las operaciones de stock se hacen a ' +
            'nivel de lote.',
          properties: {
            id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            itemId: {
              description:
                'Referencia al item. En las lecturas viene populado con ' +
                '{ id, nombre, codigo, tipo }.',
              oneOf: [
                { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0e' },
                {
                  type: 'object',
                  properties: {
                    id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0e' },
                    nombre: { type: 'string', example: 'Ácido clorhídrico' },
                    codigo: { type: 'string', example: 'RCT-HCL-01' },
                    tipo: { type: 'string', example: 'reactivo' },
                  },
                },
              ],
            },
            cantidadDisponible: {
              type: 'number',
              minimum: 0,
              example: 500,
            },
            laboratorioId: {
              type: 'string',
              nullable: true,
              description: 'Ubicación física; null = DEPÓSITO',
              example: null,
            },
            estado: {
              type: 'string',
              enum: ['disponible', 'descartado'],
              example: 'disponible',
            },
            fechaCreacion: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de recepción de la tanda física (desempate FIFO)',
            },
            fechaVencimiento: {
              type: 'string',
              format: 'date-time',
              nullable: true,
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
        LoteInput: {
          type: 'object',
          required: ['itemId', 'cantidadDisponible'],
          properties: {
            itemId: {
              type: 'string',
              description: 'ObjectId del item al que pertenece el lote',
              example: '665f1a2b3c4d5e6f7a8b9c0e',
            },
            cantidadDisponible: {
              type: 'number',
              minimum: 0,
              example: 500,
            },
            laboratorioId: {
              type: 'string',
              nullable: true,
              description: 'Ubicación; null u omitido = DEPÓSITO',
              example: null,
            },
            estado: {
              type: 'string',
              enum: ['disponible', 'descartado'],
              description: 'Opcional; por defecto "disponible"',
              example: 'disponible',
            },
            fechaCreacion: {
              type: 'string',
              format: 'date-time',
              description: 'Opcional; por defecto ahora',
            },
            fechaVencimiento: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        TransferirLoteInput: {
          type: 'object',
          required: ['laboratorioDestinoId'],
          properties: {
            laboratorioDestinoId: {
              type: 'string',
              nullable: true,
              description:
                'Laboratorio destino, o null para DEVOLVER al depósito. ' +
                'Obligatorio enviarlo explícitamente (null incluido).',
              example: '665f1a2b3c4d5e6f7a8b9c0f',
            },
            cantidad: {
              type: 'integer',
              minimum: 1,
              description:
                'Opcional. Si se envía (y es menor a la disponible), la ' +
                'transferencia es parcial: se mueve esa porción a un lote nuevo.',
              example: 100,
            },
            observacion: {
              type: 'string',
              maxLength: 500,
              example: 'Traslado para práctica de laboratorio',
            },
          },
        },
        Reserva: {
          type: 'object',
          description:
            'Asignación concreta de tiempo, espacio y recursos físicos. Se ' +
            'genera automáticamente al aprobar un Pedido (no se crea vía API).',
          properties: {
            id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            pedidoId: {
              description:
                'Pedido de origen. En las lecturas viene populado con ' +
                '{ materia, alumnos }.',
              oneOf: [{ type: 'string' }, { type: 'object' }],
            },
            laboratorioId: {
              description:
                'Laboratorio. Populado con { nombre, tipo, capacidad } en ' +
                'algunas lecturas.',
              oneOf: [{ type: 'string' }, { type: 'object' }],
            },
            docenteId: {
              description:
                'Docente. Populado con { nombre, apellido, email } en las lecturas.',
              oneOf: [{ type: 'string' }, { type: 'object' }],
            },
            fechaHora: {
              type: 'string',
              format: 'date-time',
              description: 'Inicio nominal de la clase',
            },
            duracionClase: {
              type: 'number',
              description: 'Duración en minutos',
              example: 120,
            },
            fechaInicioReal: {
              type: 'string',
              format: 'date-time',
              description: 'fechaHora − 1h (derivada en pre-save)',
            },
            fechaFinReal: {
              type: 'string',
              format: 'date-time',
              description: 'fechaHora + (duracionClase + 30 min) (derivada)',
            },
            estado: {
              type: 'string',
              enum: [
                'Pendiente',
                'En Curso',
                'Finalizada',
                'Cancelada',
                'Conflicto',
              ],
              example: 'Pendiente',
            },
            equiposReservados: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  equipoId: {
                    description: 'Equipo (populable con nombre/tipo/codigo)',
                    oneOf: [{ type: 'string' }, { type: 'object' }],
                  },
                },
              },
            },
            materialesReservados: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  itemId: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0e' },
                  cantidadTotal: { type: 'number', example: 200 },
                  cantidadConsumidaReal: {
                    type: 'number',
                    description:
                      'Consumo físico real reportado al finalizar a mano. ' +
                      'Ausente = se consumió todo lo reservado.',
                    example: 150,
                  },
                  consumoEjecutado: {
                    type: 'boolean',
                    description:
                      '¿Ya se descontó físicamente el stock de este material?',
                    example: true,
                  },
                  lotesUsados: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        loteId: { type: 'string' },
                        cantidad: { type: 'number', example: 100 },
                      },
                    },
                  },
                },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        FinalizarReservaInput: {
          type: 'object',
          description:
            'Consumo real de cada consumible. Los itemId omitidos se dan por ' +
            'consumidos en su totalidad; un consumo mayor a lo reservado se ' +
            'clampa a lo reservado.',
          properties: {
            consumos: {
              type: 'array',
              items: {
                type: 'object',
                required: ['itemId', 'cantidadConsumida'],
                properties: {
                  itemId: {
                    type: 'string',
                    description: 'ObjectId (24 hex) del consumible',
                    example: '665f1a2b3c4d5e6f7a8b9c0e',
                  },
                  cantidadConsumida: {
                    type: 'number',
                    minimum: 0,
                    example: 150,
                  },
                },
              },
            },
          },
        },
        Actividad: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            nombre: { type: 'string', example: 'Práctica de titulación ácido-base' },
            fecha: { type: 'string', format: 'date-time' },
            tipo: {
              type: 'string',
              enum: ['quimica', 'biologia', 'teorica'],
              example: 'quimica',
            },
            estado: {
              type: 'string',
              enum: ['planificada', 'en_proceso', 'finalizada'],
              example: 'planificada',
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
        ActividadInput: {
          type: 'object',
          required: ['nombre', 'fecha', 'tipo'],
          properties: {
            nombre: {
              type: 'string',
              example: 'Práctica de titulación ácido-base',
            },
            fecha: { type: 'string', format: 'date-time' },
            tipo: {
              type: 'string',
              enum: ['quimica', 'biologia', 'teorica'],
              example: 'quimica',
            },
            estado: {
              type: 'string',
              enum: ['planificada', 'en_proceso', 'finalizada'],
              description: 'Opcional; por defecto "planificada"',
              example: 'planificada',
            },
          },
        },
        SugerenciasActividad: {
          type: 'object',
          description:
            'Recursos sugeridos para una actividad según su tipo, con su ' +
            'disponibilidad actual.',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item: { $ref: '#/components/schemas/Item' },
                  cantidadSugerida: { type: 'number', example: 100 },
                  stockDisponible: { type: 'number', example: 500 },
                  disponible: {
                    type: 'boolean',
                    description: 'true si stockDisponible >= cantidadSugerida',
                    example: true,
                  },
                },
              },
            },
            equipos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  equipo: { $ref: '#/components/schemas/Equipo' },
                  cantidadSugerida: { type: 'number', example: 2 },
                  disponible: {
                    type: 'boolean',
                    description: 'true si el equipo está disponible y activo',
                    example: true,
                  },
                },
              },
            },
          },
        },
        Descarte: {
          type: 'object',
          description:
            'Registro de descarte de un recurso reutilizable de una reserva. ' +
            'Para materiales/reactivos sólo aplica a items reutilizables ' +
            '(esConsumible=false); los consumibles se reportan vía consumo al ' +
            'finalizar. Para equipos, los pasa a "fuera de servicio".',
          properties: {
            id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            pedidoId: {
              description: 'Pedido de origen (populado con { materia, fechaHora } en lecturas)',
              oneOf: [{ type: 'string' }, { type: 'object' }],
            },
            reservaId: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0e' },
            tipo: {
              type: 'string',
              enum: ['material', 'reactivo', 'equipo'],
              example: 'material',
            },
            itemId: {
              description:
                'Presente si tipo es material/reactivo (populado con ' +
                '{ nombre, codigo, unidad } en lecturas)',
              oneOf: [{ type: 'string' }, { type: 'object' }],
              nullable: true,
            },
            equipoId: {
              description:
                'Presente si tipo es equipo (populado con { nombre, codigo } en lecturas)',
              oneOf: [{ type: 'string' }, { type: 'object' }],
              nullable: true,
            },
            cantidad: { type: 'integer', minimum: 1, example: 2 },
            motivo: {
              type: 'string',
              maxLength: 500,
              example: 'Material roto durante la práctica',
            },
            usuarioId: {
              description: 'Usuario que registró el descarte (populado en lecturas)',
              oneOf: [{ type: 'string' }, { type: 'object' }],
            },
            lotesAfectados: {
              type: 'array',
              description: 'Lotes de donde se descontó el stock (FIFO), para materiales/reactivos',
              items: {
                type: 'object',
                properties: {
                  loteId: { type: 'string' },
                  cantidad: { type: 'number', example: 2 },
                },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        DescarteInput: {
          type: 'object',
          required: ['tipo', 'cantidad', 'motivo'],
          properties: {
            tipo: {
              type: 'string',
              enum: ['material', 'reactivo', 'equipo'],
              example: 'material',
            },
            itemId: {
              type: 'string',
              description:
                'ObjectId (24 hex). Obligatorio si tipo es material/reactivo; ' +
                'prohibido para equipo.',
              example: '665f1a2b3c4d5e6f7a8b9c0e',
            },
            equipoId: {
              type: 'string',
              description:
                'ObjectId (24 hex). Obligatorio si tipo es equipo; prohibido ' +
                'para material/reactivo.',
            },
            cantidad: { type: 'integer', minimum: 1, example: 2 },
            motivo: {
              type: 'string',
              minLength: 5,
              maxLength: 500,
              example: 'Material roto durante la práctica',
            },
          },
        },
        PedidoRecurso: {
          type: 'object',
          required: ['recursoId', 'tipoRecurso', 'cantidad'],
          properties: {
            recursoId: {
              type: 'string',
              description:
                'ObjectId del Equipo o Item. En las lecturas viene populado.',
              example: '665f1a2b3c4d5e6f7a8b9c0e',
            },
            tipoRecurso: {
              type: 'string',
              enum: ['Equipo', 'Item'],
              description: 'Colección referenciada (populate dinámico)',
              example: 'Item',
            },
            cantidad: { type: 'number', minimum: 1, example: 3 },
          },
        },
        PedidoTarea: {
          type: 'object',
          description: 'Ítem del checklist de preparación del pedido',
          properties: {
            id: { type: 'string' },
            descripcion: {
              type: 'string',
              example: 'Acondicionar material: vasos de precipitado.',
            },
            estado: {
              type: 'string',
              enum: ['Pendiente', 'En Proceso', 'Completada'],
              example: 'Pendiente',
            },
            tipo: {
              type: 'string',
              enum: ['Logistica', 'Preparacion', 'Compra', 'General'],
              example: 'Logistica',
            },
          },
        },
        PedidoComentario: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            usuario: {
              description: 'Autor (populado con { nombre, apellido, rol } en lecturas)',
              oneOf: [{ type: 'string' }, { type: 'object' }],
            },
            mensaje: { type: 'string', maxLength: 1000, example: 'Falta asignar laboratorio' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PedidoHistorial: {
          type: 'object',
          description: 'Entrada del audit trail del pedido',
          properties: {
            id: { type: 'string' },
            usuario: {
              oneOf: [{ type: 'string' }, { type: 'object' }],
            },
            accion: {
              type: 'string',
              enum: [
                'CREACION',
                'MODIFICACION',
                'CAMBIO_ESTADO',
                'APROBACION',
                'RECHAZO',
                'FINALIZACION',
                'COMENTARIO',
                'ELIMINACION',
              ],
              example: 'APROBACION',
            },
            descripcion: { type: 'string', example: 'Pedido aprobado' },
            cambios: {
              type: 'object',
              description: 'Detalle de los cambios (forma libre según la acción)',
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Pedido: {
          type: 'object',
          description:
            'Solicitud de uso de laboratorio (entidad central). Lifecycle: ' +
            'Pendiente → Aceptado → Finalizado (o Rechazado/Cancelado/Expirado).',
          properties: {
            id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            materia: { type: 'string', example: 'Química Orgánica I' },
            docente: {
              description: 'Docente solicitante (populado con { nombre, apellido, email })',
              oneOf: [{ type: 'string' }, { type: 'object' }],
            },
            fechaHora: { type: 'string', format: 'date-time' },
            duracionClase: { type: 'number', description: 'Minutos', example: 120 },
            fechaInicioReal: {
              type: 'string',
              format: 'date-time',
              description: 'Ventana calculada (derivada)',
            },
            fechaFinReal: { type: 'string', format: 'date-time' },
            laboratorio: {
              description:
                'Laboratorio asignado (puede ser null hasta antes de aprobar). ' +
                'Populado con { nombre, tipo }.',
              oneOf: [{ type: 'string' }, { type: 'object' }],
              nullable: true,
            },
            alumnos: { type: 'number', minimum: 1, example: 25 },
            estado: {
              type: 'string',
              enum: [
                'Pendiente',
                'Aceptado',
                'Rechazado',
                'Finalizado',
                'Cancelado',
                'Expirado',
              ],
              example: 'Pendiente',
            },
            motivoRechazo: { type: 'string', nullable: true },
            recursos: {
              type: 'array',
              items: { $ref: '#/components/schemas/PedidoRecurso' },
            },
            detalleProblemas: {
              type: 'array',
              items: { type: 'string' },
            },
            checklist: {
              type: 'array',
              items: { $ref: '#/components/schemas/PedidoTarea' },
            },
            comentarios: {
              type: 'array',
              items: { $ref: '#/components/schemas/PedidoComentario' },
            },
            historial: {
              type: 'array',
              items: { $ref: '#/components/schemas/PedidoHistorial' },
            },
            activo: {
              type: 'boolean',
              description: 'false indica borrado lógico',
              example: true,
            },
            conflictos: {
              type: 'array',
              description:
                'Sólo presente en GET /pedido/{id}: conflictos de ' +
                'disponibilidad detectados en el momento de la consulta.',
              items: { type: 'object' },
            },
            tieneComentariosNuevos: {
              type: 'boolean',
              description: 'Sólo en el listado: hay comentarios no vistos por el usuario actual',
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PedidoInput: {
          type: 'object',
          description:
            'Debe incluir `fechaHora` (ISO) O la combinación `fecha` + `hora`, ' +
            'no ambas. No se aceptan fechaInicioReal/fechaFinReal (se calculan).',
          required: ['materia', 'docente', 'duracionClase', 'alumnos'],
          properties: {
            materia: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              example: 'Química Orgánica I',
            },
            docente: {
              type: 'string',
              description: 'ObjectId (24 hex) del docente',
              example: '665f1a2b3c4d5e6f7a8b9c0e',
            },
            fechaHora: {
              type: 'string',
              format: 'date-time',
              description: 'Alternativa a fecha + hora',
            },
            fecha: {
              type: 'string',
              description: 'Requiere también `hora`. Alternativa a fechaHora.',
              example: '2026-08-01',
            },
            hora: { type: 'string', example: '14:00' },
            duracionClase: {
              type: 'integer',
              minimum: 1,
              description: 'Minutos',
              example: 120,
            },
            laboratorio: {
              type: 'string',
              nullable: true,
              description: 'ObjectId (24 hex), null o vacío. Puede asignarse después.',
              example: null,
            },
            alumnos: { type: 'integer', minimum: 1, example: 25 },
            recursos: {
              type: 'array',
              items: { $ref: '#/components/schemas/PedidoRecurso' },
            },
            checklist: {
              type: 'array',
              items: { $ref: '#/components/schemas/PedidoTarea' },
            },
          },
        },
        PedidoEstadoInput: {
          type: 'object',
          required: ['estado'],
          properties: {
            estado: {
              type: 'string',
              enum: [
                'Pendiente',
                'Aceptado',
                'Rechazado',
                'Finalizado',
                'Cancelado',
                'Expirado',
              ],
              example: 'Cancelado',
            },
            motivoRechazo: {
              type: 'string',
              description: 'Se usa cuando el nuevo estado es "Rechazado"',
              example: 'No hay laboratorio disponible en ese horario',
            },
          },
        },
        ChecklistInput: {
          type: 'object',
          required: ['checklist'],
          properties: {
            checklist: {
              type: 'array',
              items: { $ref: '#/components/schemas/PedidoTarea' },
            },
          },
        },
        ComentarioInput: {
          type: 'object',
          required: ['mensaje'],
          properties: {
            mensaje: {
              type: 'string',
              maxLength: 1000,
              example: 'Confirmado el laboratorio 3 para esta franja',
            },
          },
        },
        FinalizarPedidoInput: {
          type: 'object',
          description:
            'Todo opcional: sin cuerpo se finaliza asumiendo consumo total de ' +
            'consumibles y sin descartes.',
          properties: {
            consumos: {
              type: 'array',
              description: 'Consumo real de consumibles (para devolver el sobrante)',
              items: {
                type: 'object',
                required: ['itemId', 'cantidadConsumida'],
                properties: {
                  itemId: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0e' },
                  cantidadConsumida: { type: 'number', minimum: 0, example: 150 },
                },
              },
            },
            descartes: {
              type: 'array',
              description: 'Descartes de reutilizables (materiales/reactivos)',
              items: {
                type: 'object',
                properties: {
                  tipo: { type: 'string', example: 'material' },
                  itemId: { type: 'string' },
                  equipoId: { type: 'string' },
                  cantidad: { type: 'number', minimum: 1, example: 1 },
                  motivo: { type: 'string', example: 'Se rompió durante la práctica' },
                },
              },
            },
            desperfectos: {
              type: 'array',
              description:
                'Equipos con desperfecto (se envían a mantenimiento). Cada ' +
                'elemento es el equipoId (string) o { equipoId, motivo }.',
              items: {
                oneOf: [
                  { type: 'string' },
                  {
                    type: 'object',
                    required: ['equipoId'],
                    properties: {
                      equipoId: { type: 'string' },
                      motivo: { type: 'string' },
                    },
                  },
                ],
              },
            },
          },
        },
        RecetaReactivo: {
          type: 'object',
          description:
            'Receta maestra de un reactivo: su composición en sustancias base ' +
            '(una receta única por reactivo).',
          properties: {
            id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            reactivoId: {
              description: 'Item de tipo reactivo (populado con { nombre, codigo, tipo, unidad })',
              oneOf: [{ type: 'string' }, { type: 'object' }],
            },
            composicion: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sustanciaId: {
                    description: 'Item sustancia base (populado en lecturas)',
                    oneOf: [{ type: 'string' }, { type: 'object' }],
                  },
                  cantidad: { type: 'number', minimum: 0, example: 50 },
                  unidad: { type: 'string', example: 'g' },
                },
              },
            },
            activo: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        RecetaReactivoInput: {
          type: 'object',
          required: ['reactivoId', 'composicion'],
          properties: {
            reactivoId: {
              type: 'string',
              description: 'ObjectId del reactivo (único por receta)',
              example: '665f1a2b3c4d5e6f7a8b9c0e',
            },
            composicion: {
              type: 'array',
              items: {
                type: 'object',
                required: ['sustanciaId', 'cantidad', 'unidad'],
                properties: {
                  sustanciaId: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0f' },
                  cantidad: { type: 'number', minimum: 0, example: 50 },
                  unidad: { type: 'string', example: 'g' },
                },
              },
            },
          },
        },
        ProduccionReactivo: {
          type: 'object',
          description:
            'Registro histórico de una producción de reactivo a partir de su receta.',
          properties: {
            id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            reactivoId: {
              description: 'Reactivo producido (populado en lecturas)',
              oneOf: [{ type: 'string' }, { type: 'object' }],
            },
            composicionReal: {
              type: 'array',
              description: 'Sustancias efectivamente usadas',
              items: {
                type: 'object',
                properties: {
                  sustanciaId: {
                    oneOf: [{ type: 'string' }, { type: 'object' }],
                  },
                  cantidadUsada: { type: 'number', minimum: 0, example: 48 },
                },
              },
            },
            cantidadGenerada: { type: 'number', minimum: 0, example: 500 },
            fecha: { type: 'string', format: 'date-time' },
            activo: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ProduccionReactivoInput: {
          type: 'object',
          required: ['reactivoId', 'composicionReal', 'cantidadGenerada'],
          properties: {
            reactivoId: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0e' },
            composicionReal: {
              type: 'array',
              items: {
                type: 'object',
                required: ['sustanciaId', 'cantidadUsada'],
                properties: {
                  sustanciaId: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0f' },
                  cantidadUsada: { type: 'number', minimum: 0, example: 48 },
                },
              },
            },
            cantidadGenerada: { type: 'number', minimum: 0, example: 500 },
            fecha: {
              type: 'string',
              format: 'date-time',
              description: 'Opcional; por defecto ahora',
            },
          },
        },
        SugerenciaRecurso: {
          type: 'object',
          description:
            'Recurso (item o equipo) sugerido para un tipo de actividad. Debe ' +
            'tener itemId O equipoId, no ambos.',
          properties: {
            id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            tipoActividad: {
              type: 'string',
              enum: ['quimica', 'biologia', 'teorica'],
              example: 'quimica',
            },
            itemId: {
              description: 'Item sugerido (populado con { nombre, codigo }); null si es equipo',
              oneOf: [{ type: 'string' }, { type: 'object' }],
              nullable: true,
            },
            equipoId: {
              description: 'Equipo sugerido (populado con { nombre, codigo, estado }); null si es item',
              oneOf: [{ type: 'string' }, { type: 'object' }],
              nullable: true,
            },
            cantidadSugerida: { type: 'number', minimum: 1, example: 2 },
            orden: { type: 'number', example: 0 },
            activo: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        SugerenciaRecursoInput: {
          type: 'object',
          required: ['tipoActividad', 'cantidadSugerida'],
          description: 'Debe incluir itemId O equipoId (exactamente uno).',
          properties: {
            tipoActividad: {
              type: 'string',
              enum: ['quimica', 'biologia', 'teorica'],
              example: 'quimica',
            },
            itemId: {
              type: 'string',
              nullable: true,
              description: 'ObjectId (24 hex). Excluyente con equipoId.',
              example: '665f1a2b3c4d5e6f7a8b9c0e',
            },
            equipoId: {
              type: 'string',
              nullable: true,
              description: 'ObjectId (24 hex). Excluyente con itemId.',
            },
            cantidadSugerida: { type: 'integer', minimum: 1, example: 2 },
            activo: { type: 'boolean' },
          },
        },
        MovimientoStock: {
          type: 'object',
          description:
            'Entrada del historial de auditoría del stock físico. Existe si y ' +
            'sólo si cambió el stock físico de un item (salvo movimientos de ' +
            'ubicación, con cantidad 0).',
          properties: {
            id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            itemId: {
              description: 'Item afectado (populado con { nombre, codigo, unidad })',
              oneOf: [{ type: 'string' }, { type: 'object' }],
            },
            tipoMovimiento: {
              type: 'string',
              enum: [
                'APROBACION_RESERVA',
                'DEVOLUCION',
                'DESCARTE',
                'COMPRA',
                'AJUSTE_MANUAL',
                'TRANSFERENCIA',
                'BAJA',
              ],
              example: 'COMPRA',
            },
            cantidad: {
              type: 'number',
              description: 'Delta físico signado (negativo = egreso, positivo = ingreso; 0 = ubicación)',
              example: 100,
            },
            cantidadAnterior: {
              type: 'number',
              description: 'Stock físico agregado antes del movimiento',
              example: 400,
            },
            cantidadNueva: {
              type: 'number',
              description: 'Stock físico agregado después',
              example: 500,
            },
            origenLaboratorioId: {
              oneOf: [{ type: 'string' }, { type: 'object' }],
              nullable: true,
            },
            destinoLaboratorioId: {
              oneOf: [{ type: 'string' }, { type: 'object' }],
              nullable: true,
            },
            reservaId: { type: 'string', nullable: true },
            loteId: { type: 'string', nullable: true },
            usuarioId: {
              description: 'Usuario que originó el movimiento (null si fue el sistema/cron)',
              oneOf: [{ type: 'string' }, { type: 'object' }],
              nullable: true,
            },
            observacion: { type: 'string', maxLength: 500 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
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
        UsuarioInput: {
          type: 'object',
          required: ['nombre', 'apellido', 'email', 'password', 'rol'],
          properties: {
            nombre: { type: 'string', example: 'Ada' },
            apellido: { type: 'string', example: 'Lovelace' },
            email: {
              type: 'string',
              format: 'email',
              example: 'ada@universidad.edu',
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 6,
              example: 'secreto123',
            },
            legajo: {
              type: 'string',
              description: 'Opcional; puede omitirse o enviarse vacío',
              example: '12345',
            },
            rol: {
              type: 'string',
              enum: ['DOCENTE', 'PERSONAL', 'ADMIN'],
              example: 'DOCENTE',
            },
            estado: {
              type: 'string',
              enum: ['ACTIVO', 'PENDIENTE', 'SUSPENDIDO'],
              example: 'PENDIENTE',
            },
          },
        },
        UsuarioUpdateInput: {
          type: 'object',
          description:
            'Al menos un campo. Los campos `rol` y `activo` se ignoran en ' +
            'la actualización (no pueden modificarse por esta vía).',
          minProperties: 1,
          properties: {
            nombre: { type: 'string', example: 'Ada' },
            apellido: { type: 'string', example: 'Lovelace' },
            email: {
              type: 'string',
              format: 'email',
              example: 'ada@universidad.edu',
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 6,
              example: 'nuevoSecreto123',
            },
            legajo: {
              type: 'string',
              description: 'Enviar vacío elimina el legajo',
              example: '12345',
            },
            estado: {
              type: 'string',
              enum: ['ACTIVO', 'PENDIENTE', 'SUSPENDIDO'],
              example: 'ACTIVO',
            },
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
      { name: 'Laboratorios', description: 'Gestión de laboratorios' },
      {
        name: 'Equipos',
        description: 'Gestión de equipos, mantenimientos y estadísticas de uso',
      },
      { name: 'Items', description: 'Gestión del catálogo de items de inventario' },
      {
        name: 'Lotes',
        description: 'Gestión de lotes de stock (inventario físico) y transferencias',
      },
      {
        name: 'Reservas',
        description: 'Consulta y cierre de reservas de laboratorio (calendario)',
      },
      {
        name: 'Actividades',
        description: 'Gestión de actividades y sugerencias de recursos',
      },
      {
        name: 'Descartes',
        description: 'Registro e historial de descartes de recursos',
      },
      {
        name: 'Pedidos',
        description:
          'Solicitudes de uso de laboratorio: ciclo de vida, aprobación, ' +
          'finalización, checklist y comentarios',
      },
      {
        name: 'Recetas de Reactivos',
        description: 'Recetas maestras de composición de reactivos',
      },
      {
        name: 'Producción de Reactivos',
        description: 'Historial de producción de reactivos a partir de recetas',
      },
      {
        name: 'Sugerencias de Recursos',
        description: 'Recursos sugeridos por tipo de actividad',
      },
      {
        name: 'Movimientos de Stock',
        description: 'Historial de auditoría de los cambios de stock físico',
      },
      { name: 'Usuarios', description: 'Gestión de usuarios y autenticación' },
    ],
  },
  // Archivos donde swagger-jsdoc buscará anotaciones @swagger.
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
