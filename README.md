# 🎟️ TicketRush — Sistema Distribuido de Concurrencia y Worker Threads

> **Aplicaciones Distribuidas**  
> Sistema de reserva de cupos concurrentes con consistencia global mediante **Redis (Script Lua Atómico)** y procesamiento intensivo CPU-bound mediante **Node.js Worker Threads Pool** desplegado sobre **Kubernetes**.

---

## 📌 Arquitectura del Sistema

```
                      +-----------------------------+
                      |   Clientes / k6 Load Test   |
                      +-----------------------------+
                                     |
                                     v
                  +-------------------------------------+
                  | Kubernetes Service (NodePort:30090) |
                  +-------------------------------------+
                                     |
             +-----------------------+-----------------------+
             |                       |                       |
             v                       v                       v
      +--------------+        +--------------+        +--------------+
      |  Pod #1 Node |        |  Pod #2 Node |        |  Pod #3 Node |
      |  Worker Pool |        |  Worker Pool |        |  Worker Pool |
      +--------------+        +--------------+        +--------------+
             |                       |                       |
             +-----------------------+-----------------------+
                                     |
                                     v
                        +--------------------------+
                        |  Redis Cluster / Service |
                        | (Single Source of Truth) |
                        +--------------------------+
```

### Problemas Abordados
1. **Consistencia Distribuida:** Múltiples Pods intentando modificar el mismo recurso lógico (20 cupos). Se previene sobreventa y lecturas sucias mediante scripts atómicos en Lua sobre Redis (`EVAL`).
2. **Procesamiento Concurrente:** Procesamiento CPU-bound (hashing SHA-256 / firma criptográfica) delegado a un **Pool de Worker Threads** en cada Pod para evitar bloquear el Event Loop de Node.js.

---

## 📂 Estructura del Proyecto

```
thread-lab/
├── src/
│   ├── server.js          # Servidor HTTP nativo con Dashboard Web en tiempo real
│   ├── ticket-manager.js  # Gestor de cupos (soporte Local Memory y Redis atómico)
│   ├── cpu-task.js         # Tarea CPU-bound intensiva (SHA-256)
│   ├── worker-pool.js      # Pool de Worker Threads con cola FIFO y límite
│   └── worker.js           # Script ejecutor del Worker Thread
├── k8s/
│   ├── namespace.yaml      # Namespace 'ticketrush'
│   ├── redis.yaml          # Despliegue y servicio ClusterIP de Redis
│   ├── ticketrush-local.yaml  # 3 Réplicas con memoria local (evidencia de sobreventa)
│   └── ticketrush-redis.yaml  # 3 Réplicas conectadas a Redis central
├── k6/
│   ├── test1_single_instance.js    # Prueba monolito en un proceso
│   ├── test2_distributed_local.js  # Prueba de sobreventa (3 pods, memoria local)
│   ├── test2_distributed_redis.js  # Prueba de consistencia distribuida con Redis
│   ├── test3_ping_availability.js  # Comparativa Main Thread vs Worker Threads
│   ├── test4_worker_limits.js      # Benchmark de límite de workers (1, 2, 4, 8)
│   └── test8_final_integrated.js   # Prueba integrada con tráfico cruzado
├── demos/                 # Scripts introductorios de concurrencia y mutex
├── Dockerfile             # Imagen multi-stage ligera en Node 22 Alpine
├── package.json           # Dependencias y scripts npm
└── .gitignore             # Configuración de exclusión para Git
```

---

## 🚀 Despliegue y Ejecución

### 1. Ejecución Local (Desarrollo)

```bash
# Instalar dependencias
npm install

# Iniciar servidor local
npm start
```

Abrir [http://localhost:3000](http://localhost:3000) para acceder al Dashboard interactivo.

---

### 2. Despliegue en Kubernetes

#### A. Construir la imagen Docker
```bash
docker build -t ticketrush:latest .
```

#### B. Desplegar Redis y TicketRush en Kubernetes
```bash
# Crear namespace
kubectl apply -f k8s/namespace.yaml

# Desplegar Redis
kubectl apply -f k8s/redis.yaml

# Desplegar TicketRush (3 réplicas con Redis)
kubectl apply -f k8s/ticketrush-redis.yaml
```

Verificar estado de los Pods:
```bash
kubectl get pods -n ticketrush -o wide
```

Acceder al servicio desde el navegador:  
👉 **[http://localhost:30090](http://localhost:30090)**

---

## 📡 Endpoints de la API

| Endpoint | Método | Descripción |
|---|:---:|---|
| `/ping` | `GET` | Health Check y monitoreo de disponibilidad del Pod. Devuelve timestamp y hostname. |
| `/status` | `GET` | Estado actual: cupos disponibles, aprobados, rechazados y métricas del Worker Pool. |
| `/reserve` | `POST` | Intenta reservar un cupo atómicamente. Soporta query params: `?cpu=worker&ms=100`. |
| `/reset` | `POST` | Reinicia los cupos a 20 (en memoria o Redis). |
| `/config` | `POST` | Modifica en caliente la configuración (`maxWorkers`, `storageMode`). |

---

## 🧪 Pruebas de Carga con k6

```bash
# 1. Prueba de una sola instancia
npm run test:single

# 2. Prueba distribuida con sobreventa (Modo Local)
npm run test:local

# 3. Prueba distribuida con consistencia garantizada (Modo Redis)
npm run test:redis

# 4. Prueba de disponibilidad /ping (Main Thread vs Worker Threads)
npm run test:ping

# 5. Benchmark de límite de Workers (1, 2, 4, 8)
npm run test:workers

# 6. Prueba integrada final completa
npm run test:final
```

---

## 🛠️ Tecnologías

- **Runtime:** Node.js 22 LTS
- **Almacenamiento y Coordinación:** Redis 7 (EVAL Lua Scripts)
- **Hilos de Procesamiento:** Node.js `worker_threads` (Worker Pool pattern)
- **Contenedores y Orquestación:** Docker, Kubernetes (Deployments, Services, NodePort)
- **Pruebas de Rendimiento:** Grafana k6
