# Sistema de Gestión de Laboratorios – Backend

> **API REST** desarrollada con **Node.js, Express y MongoDB** para la gestión de laboratorios de docencia de Biología y Química.

## Descripción

Este proyecto implementa el backend del Trabajo Práctico **Gestión de Laboratorios de Docencia**. La aplicación centraliza la administración de laboratorios, edificios, equipamiento, materiales, reactivos, reservas y pedidos realizados por docentes.

El sistema busca facilitar la planificación de actividades prácticas, el control de disponibilidad de recursos y el seguimiento del stock, proporcionando una única API para el frontend.

---

# Tecnologías

- Node.js
- Express
- MongoDB
- Mongoose
- Docker
- Docker Compose
- Nodemon
- Vitest

# Requisitos

- Docker Desktop
- Docker Compose
- Node.js 18+
- npm

# Instalación

## 1. Construir los contenedores

```bash
docker-compose up --build
```

## 2. Instalar dependencias

```bash
npm install
```

## 3. Cargar datos iniciales

```bash
npm run seed
```

## 4. Ejecutar el servidor

```bash
npm run dev
```

## Ejecución rápida

```bash
docker-compose up --build

npm install

npm run seed

npm run dev
```

# Arquitectura

```
Cliente
   │
Express
   │
Routes
   │
Controllers
   │
Services
   │
Models (Mongoose)
   │
MongoDB
```

## Organización

```
src/
├── config/
├── controllers/
├── middlewares/
├── models/
├── routes/
├── seed/
├── services/
├── utils/
└── main.js
```

# Módulos implementados

- Usuarios
- Edificios
- Laboratorios
- Actividades
- Equipos
- Ítems
- Lotes
- Movimientos de Stock
- Pedidos
- Reservas
- Producción de Reactivos
- Recetas de Reactivos
- Descartes
- Sugerencias de Recursos

# Modelo de dominio

## Laboratorios
Administración de laboratorios universitarios indicando edificio, capacidad y disponibilidad.

## Edificios
Ubicación física de los laboratorios.

## Equipos
Gestión del equipamiento utilizado durante las actividades.

## Ítems
Catálogo de materiales, reactivos e insumos.

## Lotes
Representan el stock físico disponible.

## Movimientos de Stock
Registro de ingresos, egresos y ajustes.

## Pedidos
Solicitudes realizadas por docentes para utilizar laboratorios y recursos.

## Reservas
Bloquean recursos y laboratorios durante los períodos establecidos.

## Producción y Recetas
Permiten registrar la elaboración de reactivos.

## Descartes
Registro de bajas y descartes de materiales.

# Scripts

| Script | Descripción |
|---|---|
| npm run dev | Desarrollo con Nodemon |
| npm run seed | Datos iniciales |
| npm test | Ejecuta pruebas |
| npm run test:ui | Interfaz de Vitest |
| npm run coverage | Cobertura |

# Testing

El proyecto utiliza Vitest para pruebas automatizadas.

# Consideraciones

- Ejecutar MongoDB mediante Docker antes de iniciar el servidor.
- Ejecutar el seed únicamente la primera vez o cuando sea necesario reinicializar los datos.

# Mejoras futuras

- Dashboard estadístico.
- Reportes de utilización.
- Alertas de stock.
- Mantenimientos programados.
- Exportación de información.

