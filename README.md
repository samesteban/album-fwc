# Álbum Mundial 48 — Control de Láminas

Una aplicación web progresiva (PWA) para gestionar el progreso de tu colección del **Álbum Mundial de 48 Selecciones**. Lleva el control de láminas pegadas, repetidas y faltantes de forma rápida y sencilla, directamente desde tu navegador.

Características principales:
- 📊 **Dashboard** con estadísticas visuales: progreso total, porcentaje de completado, faltantes y repetidas
- 🔍 **Buscador rápido** de láminas por código (ej: `ARG 15`, `FWC 00`) o nombre de país
- 🏆 **Top 10** de láminas más repetidas para intercambiar
- 📋 **Vista por secciones** con grid de 48 selecciones + secciones especiales (FWC y Coca-Cola)
- 💾 **Persistencia local** automática en LocalStorage — tus datos se guardan al instante
- 📱 **Diseño mobile-first** con navegación tipo app, ideal para usar en celular

## Stack

| Tecnología | Versión |
|-----------|---------|
| [React](https://react.dev/) | 19 |
| [Vite](https://vitejs.dev/) | 6 |
| [TypeScript](https://www.typescriptlang.org/) | 5.8 |
| [Tailwind CSS](https://tailwindcss.com/) | 4 |
| [Motion](https://motion.dev/) | 12 (animaciones) |
| [Lucide](https://lucide.dev/) | 0.546 (iconos) |

## Requisitos

- Node.js 18+

## Instalación y uso

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev
```

La app estará disponible en `http://localhost:3000`.

### Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia el servidor de desarrollo (puerto 3000) |
| `npm run build` | Compila para producción |
| `npm run preview` | Previsualiza la build de producción |
| `npm run lint` | Verifica tipos con TypeScript |
| `npm run clean` | Elimina archivos de build |

## Estructura del proyecto

```
src/
├── main.tsx               # Punto de entrada
├── App.tsx                # Componente principal (orquestador)
├── types.ts               # Interfaces TypeScript
├── data.ts                # Datos del álbum y persistencia
├── index.css              # Estilos globales (Tailwind)
└── components/
    ├── Dashboard.tsx       # Panel de resumen y estadísticas
    ├── CardGrid.tsx        # Cuadrícula de láminas por sección
    └── SectionModal.tsx    # Modal selector de países/secciones
```

## Licencia

Apache-2.0
