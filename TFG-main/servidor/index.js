import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURACIÓN ---
const app = express();
const port = process.env.PORT || 9001;

// Helper para obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

const dbConfig = {
  host: 'localhost',
  user: 'tfg',
  password: 'tfg',
  database: 'tfg',
  multipleStatements: true
};
const pool = mysql.createPool(dbConfig);

const TASKS_DIR = path.join(__dirname, 'task_statuses');
const TASK_TIMEOUT = 10 * 60 * 1000; // 10 minutos en milisegundos



// --- FUNCIÓN DE ARRANQUE PARA ASEGURAR USUARIO DE PRUEBA ---
const ensureTestUserExists = async () => {
    const testUserEmail = 'usuario@ejemplo.com';
    const testUserName = 'Usuario de Prueba';
    try {
        const [users] = await pool.query('SELECT Correo FROM USUARIO WHERE Correo = ?', [testUserEmail]);
        if (users.length === 0) {
            console.log(`El usuario de prueba '${testUserEmail}' no existe. Creándolo...`);
            await pool.query('INSERT INTO USUARIO (Correo, Nombre) VALUES (?, ?)', [testUserEmail, testUserName]);
            console.log('Usuario de prueba creado exitosamente.');
        }
    } catch (error) {
        console.error('Error al asegurar la existencia del usuario de prueba:', error);
    }
};
// --- FUNCIONES AUXILIARES ---
const ensureTasksDirExists = async () => {
    try {
        await fs.access(TASKS_DIR);
        console.log(`Directorio de tareas verificado en: ${TASKS_DIR}`);
    } catch (error) {
        // Si el directorio no existe (error.code === 'ENOENT'), lo creamos.
        if (error.code === 'ENOENT') {
            console.log(`El directorio de tareas no existe. Creándolo en: ${TASKS_DIR}`);
            await fs.mkdir(TASKS_DIR);
            console.log('Directorio de tareas creado exitosamente.');
        } else {
            // Si es otro error, lo mostramos y detenemos el servidor.
            console.error('Error crítico al acceder al directorio de tareas:', error);
            process.exit(1);
        }
    }
};

// --- RUTAS DE LA API ---

app.get('/api/dashboard/stats', async (req, res) => {
    // Correo del usuario para el que se obtienen las estadísticas.
    // En una aplicación real, este valor debería venir de la sesión del usuario.
    const usuarioCorreo = 'usuario@ejemplo.com'; 
    try {
        // --- 1. Estadísticas globales ---
        // Se obtienen los conteos totales de preguntas, historias y objetivos.
        const [[{ total: preguntasDisponibles }]] = await pool.query('SELECT COUNT(*) as total FROM PREGUNTA');
        const [[{ total: historiasTotales }]] = await pool.query('SELECT COUNT(*) as total FROM HISTORIA');
        const [[{ total: objetivosTotales }]] = await pool.query('SELECT COUNT(*) as total FROM OBJETIVO');

        // Se cuentan las preguntas únicas que el usuario ha respondido.
        const [answeredQuestions] = await pool.query(
            `SELECT COUNT(DISTINCT s.OpcionPreguntaId) as total FROM SELECCIONAR s JOIN INTENTO i ON s.IntentoFecha = i.Fecha WHERE i.UsuarioCorreo = ?`,
            [usuarioCorreo]
        );
        const preguntasRespondidas = answeredQuestions[0].total;
        const preguntasPendientes = preguntasDisponibles - preguntasRespondidas;
        const porcentajePendientes = preguntasDisponibles > 0 ? Math.round((preguntasPendientes / preguntasDisponibles) * 100) : 0;
        
        // --- 2. Lógica para historias y objetivos superados (LÓGICA CORREGIDA) ---
        
        // Paso 1: Obtener todos los datos necesarios con consultas eficientes.
        // a) Todas las historias y a qué objetivo pertenecen.
        const [allStories] = await pool.query('SELECT Id, ObjetivoId FROM HISTORIA');

        // b) Todas las preguntas y a qué historia pertenecen.
        const [allQuestions] = await pool.query('SELECT p.Id, c.HistoriaId FROM PREGUNTA p JOIN CRITERIO c ON p.CriterioId = c.Id');

        // c) El resultado (correcto/incorrecto) del último intento del usuario para CADA pregunta que ha respondido.
        const [lastAttempts] = await pool.query(`
            SELECT
                s.OpcionPreguntaId as preguntaId,
                o.Correcta as esCorrecta
            FROM SELECCIONAR s
            JOIN INTENTO i ON s.IntentoFecha = i.Fecha
            JOIN (
                SELECT s2.OpcionPreguntaId, MAX(i2.Fecha) as max_fecha
                FROM INTENTO i2 JOIN SELECCIONAR s2 ON i2.Fecha = s2.IntentoFecha
                WHERE i2.UsuarioCorreo = ?
                GROUP BY s2.OpcionPreguntaId
            ) as latest_attempt ON s.OpcionPreguntaId = latest_attempt.OpcionPreguntaId AND i.Fecha = latest_attempt.max_fecha
            JOIN OPCION o ON s.OpcionPreguntaId = o.PreguntaId AND s.OpcionTexto = o.Texto
            WHERE i.UsuarioCorreo = ?
        `, [usuarioCorreo, usuarioCorreo]);

        // Paso 2: Procesar los datos en JavaScript para evitar bucles de consultas.
        // a) Mapear preguntas a sus historias para una búsqueda rápida.
        const questionsByStory = allQuestions.reduce((acc, q) => {
            if (!acc[q.HistoriaId]) {
                acc[q.HistoriaId] = [];
            }
            acc[q.HistoriaId].push(q.Id);
            return acc;
        }, {});

        // b) Mapear los últimos intentos del usuario para una búsqueda rápida.
        const userAttempts = lastAttempts.reduce((acc, attempt) => {
            acc[attempt.preguntaId] = attempt.esCorrecta; // Almacena 1 si es correcta, 0 si no.
            return acc;
        }, {});

        // Paso 3: Calcular el estado de cada historia y agruparlas por objetivo.
        let historiasAprobadas = 0;
        let historiasSuspensas = 0;
        const historiasPorObjetivo = {};

        allStories.forEach(story => {
            const storyId = story.Id;
            const preguntasDeLaHistoria = questionsByStory[storyId] || [];
            const totalPreguntasHistoria = preguntasDeLaHistoria.length;
            
            let preguntasCorrectas = 0;
            let preguntasRespondidas = 0;

            if (totalPreguntasHistoria > 0) {
                preguntasDeLaHistoria.forEach(preguntaId => {
                    if (userAttempts.hasOwnProperty(preguntaId)) {
                        preguntasRespondidas++;
                        if (userAttempts[preguntaId] === 1) {
                            preguntasCorrectas++;
                        }
                    }
                });
            }

            // Calcular el estado de la historia basado en el porcentaje de aciertos.
            // Esta es la lógica correcta que me indicaste.
            let aprobada = false;
            const intentada = preguntasRespondidas > 0;

            if (intentada) {
                const porcentajeAcierto = totalPreguntasHistoria > 0 ? (preguntasCorrectas / totalPreguntasHistoria) * 100 : 0;
                if (porcentajeAcierto >= 65) {
                    aprobada = true;
                    historiasAprobadas++;
                } else {
                    historiasSuspensas++;
                }
            }

            // Añadir la historia (con su estado 'aprobada') a su objetivo correspondiente.
            if (!historiasPorObjetivo[story.ObjetivoId]) {
                historiasPorObjetivo[story.ObjetivoId] = [];
            }
            historiasPorObjetivo[story.ObjetivoId].push({ ...story, aprobada });
        });

        const historiasPendientes = historiasTotales - (historiasAprobadas + historiasSuspensas);
        
        // Paso 4: Calcular los objetivos superados.
        // Un objetivo se considera superado SÓLO SI TODAS sus historias están aprobadas.
        let objetivosSuperados = 0;
        for (const objetivoId in historiasPorObjetivo) {
            const historiasDelObjetivo = historiasPorObjetivo[objetivoId];
            if (historiasDelObjetivo.length > 0 && historiasDelObjetivo.every(s => s.aprobada)) {
                objetivosSuperados++;
            }
        }
        const porcentajeSuperados = objetivosTotales > 0 ? Math.round((objetivosSuperados / objetivosTotales) * 100) : 0;

        // --- 3. LÓGICA PARA EL GRÁFICO DE BARRAS (CORREGIDA Y OPTIMIZADA) ---
        // Se utiliza una subconsulta para asegurar que solo se considera el resultado
        // del ÚLTIMO intento de cada pregunta, evitando contar respuestas antiguas.
        const [progresoData] = await pool.query(`
            SELECT
                ob.Id,
                ob.Descripcion,
                COUNT(DISTINCT p.Id) AS total_preguntas_objetivo,
                COUNT(DISTINCT last_attempts.preguntaId) AS preguntas_respondidas_objetivo,
                COUNT(DISTINCT CASE WHEN last_attempts.esCorrecta = 1 THEN last_attempts.preguntaId ELSE NULL END) AS preguntas_correctas_objetivo
            FROM OBJETIVO ob
            LEFT JOIN HISTORIA h ON ob.Id = h.ObjetivoId
            LEFT JOIN CRITERIO c ON h.Id = c.HistoriaId
            LEFT JOIN PREGUNTA p ON c.Id = p.CriterioId
            LEFT JOIN (
                -- Esta subconsulta obtiene la respuesta del último intento para cada pregunta
                SELECT
                    s.OpcionPreguntaId as preguntaId,
                    o.Correcta as esCorrecta
                FROM SELECCIONAR s
                -- Se une con INTENTO para obtener la fecha y el usuario
                JOIN INTENTO i ON s.IntentoFecha = i.Fecha
                -- Se une con una subconsulta que calcula la fecha MÁXIMA (el último intento) para cada pregunta
                JOIN (
                    SELECT s2.OpcionPreguntaId, MAX(i2.Fecha) as max_fecha
                    FROM INTENTO i2 JOIN SELECCIONAR s2 ON i2.Fecha = s2.IntentoFecha
                    WHERE i2.UsuarioCorreo = ?
                    GROUP BY s2.OpcionPreguntaId
                ) as latest_attempt ON s.OpcionPreguntaId = latest_attempt.OpcionPreguntaId AND i.Fecha = latest_attempt.max_fecha
                -- Se une con OPCION para saber si la respuesta fue correcta
                JOIN OPCION o ON s.OpcionPreguntaId = o.PreguntaId AND s.OpcionTexto = o.Texto
                WHERE i.UsuarioCorreo = ?
            ) AS last_attempts ON p.Id = last_attempts.preguntaId
            GROUP BY ob.Id, ob.Descripcion
            ORDER BY ob.Id;
        `, [usuarioCorreo, usuarioCorreo]);

        const progressChartData = {
            categories: progresoData.map(p => p.Descripcion),
            series: [
                { 
                    name: '% Aprobados', 
                    data: progresoData.map(p => {
                        const total = p.total_preguntas_objetivo;
                        return total > 0 ? Math.round((p.preguntas_correctas_objetivo / total) * 100) : 0;
                    })
                },
                { 
                    name: '% Pendiente', 
                    data: progresoData.map(p => {
                        const total = p.total_preguntas_objetivo;
                        const pendientes = total - p.preguntas_respondidas_objetivo;
                        return total > 0 ? Math.round((pendientes / total) * 100) : 0;
                    })
                },
                { 
                    name: '% Suspensos', 
                    data: progresoData.map(p => {
                        const total = p.total_preguntas_objetivo;
                        const incorrectas = p.preguntas_respondidas_objetivo - p.preguntas_correctas_objetivo;
                        return total > 0 ? Math.round((incorrectas / total) * 100) : 0;
                    })
                }
            ]
        };
        
        // --- 4. Ensamblar respuesta ---
        const responseData = {
            stats: {
                preguntasDisponibles,
                preguntasPendientes,
                porcentajePendientes,
                objetivosSuperados,
                porcentajeSuperados,
                historiasTotales,
            },
            storiesChartData: [historiasSuspensas, historiasAprobadas, historiasPendientes],
            progressChartData
        };
        
        res.json(responseData);

    } catch (error) {
        console.error('Error al obtener las estadísticas del dashboard:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});





app.get('/api/objetivos/:objetivoId/historias', async (req, res) => {
    const { objetivoId } = req.params;
    const usuarioCorreo = 'usuario@ejemplo.com'; 

    try {
        const [historias] = await pool.query('SELECT Id, Descripcion as titulo FROM HISTORIA WHERE ObjetivoId = ?', [objetivoId]);
        
        if (historias.length === 0) {
            return res.json([]);
        }

        const historiasConDetalles = await Promise.all(historias.map(async (historia) => {
            // 1. Obtener criterios para la historia
            const [criterios] = await pool.query('SELECT Id, Descripcion as texto FROM CRITERIO WHERE HistoriaId = ?', [historia.Id]);
            
            // 2. Obtener todas las preguntas de la historia
            const [preguntas] = await pool.query(
                'SELECT Id, CriterioId FROM PREGUNTA WHERE CriterioId IN (SELECT Id FROM CRITERIO WHERE HistoriaId = ?)',
                [historia.Id]
            );

            let preguntasCorrectas = 0;
            let preguntasRespondidas = 0;
            const criteriosConEstado = [...criterios]; 

            if (preguntas.length > 0) {
                const preguntaIds = preguntas.map(p => p.Id);
                const [ultimosIntentos] = await pool.query(`
                    SELECT s.OpcionPreguntaId, o.Correcta 
                    FROM SELECCIONAR s
                    JOIN OPCION o ON s.OpcionPreguntaId = o.PreguntaId AND s.OpcionTexto = o.Texto
                    JOIN INTENTO i ON s.IntentoFecha = i.Fecha
                    WHERE i.UsuarioCorreo = ? AND s.OpcionPreguntaId IN (?)
                    AND s.IntentoFecha = (SELECT MAX(i2.Fecha) FROM INTENTO i2 JOIN SELECCIONAR s2 ON i2.Fecha = s2.IntentoFecha WHERE i2.UsuarioCorreo = ? AND s2.OpcionPreguntaId = s.OpcionPreguntaId)
                `, [usuarioCorreo, preguntaIds, usuarioCorreo]);

                preguntasRespondidas = ultimosIntentos.length;
                ultimosIntentos.forEach(intento => {
                    if (intento.Correcta) preguntasCorrectas++;
                });

                // Calcular estado por criterio
                criteriosConEstado.forEach(criterio => {
                    const preguntasDelCriterio = preguntas.filter(p => p.CriterioId === criterio.Id);
                    if (preguntasDelCriterio.length === 0) {
                        criterio.estado = 'Pendiente';
                        return;
                    }
                    const idsPreguntasCriterio = preguntasDelCriterio.map(p => p.Id);
                    const intentosDelCriterio = ultimosIntentos.filter(i => idsPreguntasCriterio.includes(i.OpcionPreguntaId));
                    if (intentosDelCriterio.length === 0) {
                        criterio.estado = 'Pendiente';
                    } else if (intentosDelCriterio.every(i => i.Correcta)) {
                        criterio.estado = 'Superado';
                    } else {
                        criterio.estado = 'No Superado';
                    }
                });
            } else {
                 criteriosConEstado.forEach(criterio => { criterio.estado = 'Pendiente'; });
            }
            
            // Calcular estado general de la historia
            let estadoHistoria = 'Pendiente';
            if (preguntasRespondidas > 0) {
                const porcentajeAcierto = preguntas.length > 0 ? (preguntasCorrectas / preguntas.length) * 100 : 0;
                estadoHistoria = porcentajeAcierto >= 65 ? 'Superado' : 'No Superado';
            }

            // Datos para el gráfico de donut
            const criteriosSuperados = criteriosConEstado.filter(c => c.estado === 'Superado').length;
            const criteriosNoSuperados = criteriosConEstado.filter(c => c.estado === 'No Superado').length;
            const criteriosPendientes = criteriosConEstado.length - (criteriosSuperados + criteriosNoSuperados);

            return {
              id: historia.Id, 
              titulo: historia.titulo,
              estado: estadoHistoria,
              expanded: false,
              criterios: criteriosConEstado,
              donutChartData: [criteriosSuperados, criteriosNoSuperados, criteriosPendientes]
          };

        }));

        res.json(historiasConDetalles);

    } catch (error) {
        console.error(`Error al obtener historias para el objetivo ${objetivoId}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});




// --- RESTO DE ENDPOINTS ---
app.get('/api/historias/:historiaId/preguntas', async (req, res) => {
  const { historiaId } = req.params;
  const { modo } = req.query; // Capturamos el modo desde la URL (?modo=repetir)
  const usuarioCorreo = 'usuario@ejemplo.com';

  // --- LOGGING ---
  console.log(`--- Recibida petición para historia ${historiaId} ---`);
  console.log(`Query params recibidos:`, req.query);
  console.log(`Modo detectado: '${modo}'`);
  // --- FIN LOGGING ---

  try {
    let query;
    const params = [historiaId];

    if (modo === 'repetir') {
      // --- Lógica para "Repetir Falladas y Pendientes" ---
      console.log(`Modo repetir activado para la historia ${historiaId}`);
      query = `
        SELECT 
            p.Id AS preguntaId, p.Enunciado AS texto, p.Explicacion AS explicacion,
            o.Texto AS opcionTexto, o.Correcta AS esCorrecta
        FROM PREGUNTA p
        JOIN OPCION o ON p.Id = o.PreguntaId
        JOIN CRITERIO c ON p.CriterioId = c.Id
        WHERE c.HistoriaId = ? AND p.Id NOT IN (
            -- Subconsulta para encontrar las preguntas que el usuario ya ha acertado en el último intento
            SELECT s.OpcionPreguntaId
            FROM SELECCIONAR s
            JOIN INTENTO i ON s.IntentoFecha = i.Fecha
            JOIN OPCION op_check ON s.OpcionPreguntaId = op_check.PreguntaId AND s.OpcionTexto = op_check.Texto
            WHERE i.UsuarioCorreo = ? AND op_check.Correcta = 1
            AND i.Fecha = (
                SELECT MAX(i2.Fecha) 
                FROM INTENTO i2 JOIN SELECCIONAR s2 ON i2.Fecha = s2.IntentoFecha
                WHERE i2.UsuarioCorreo = ? AND s2.OpcionPreguntaId = s.OpcionPreguntaId
            )
        )
        ORDER BY p.Id, RAND();
      `;
      params.push(usuarioCorreo, usuarioCorreo);
    } else {
      // --- Lógica Normal: Todas las preguntas ---
      console.log(`Modo normal activado para la historia ${historiaId}`);
      query = `
        SELECT
            p.Id AS preguntaId, p.Enunciado AS texto, p.Explicacion AS explicacion,
            o.Texto AS opcionTexto, o.Correcta AS esCorrecta
        FROM PREGUNTA p
        JOIN OPCION o ON p.Id = o.PreguntaId
        JOIN CRITERIO c ON p.CriterioId = c.Id
        WHERE c.HistoriaId = ?
        ORDER BY p.Id, RAND();
      `;
    }

    const [rows] = await pool.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No se encontraron preguntas para este modo.' });
    }

    // Agrupar preguntas y opciones
    const preguntas = {};
    rows.forEach(row => {
      if (!preguntas[row.preguntaId]) {
        preguntas[row.preguntaId] = {
          id: row.preguntaId,
          text: row.texto,
          explicacion: row.explicacion,
          options: [],
          correctAnswer: null
        };
      }
      preguntas[row.preguntaId].options.push({ label: row.opcionTexto, value: row.opcionTexto });
      if (row.esCorrecta) {
        preguntas[row.preguntaId].correctAnswer = row.opcionTexto;
      }
    });

    res.json(Object.values(preguntas));

  } catch (error) {
    console.error('Error al obtener las preguntas:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});


app.post('/api/intentos', async (req, res) => {
    const { usuarioCorreo, calificacion, respuestas } = req.body;
    if (!usuarioCorreo || calificacion === undefined || !respuestas) {
        return res.status(400).json({ error: 'Faltan datos en la petición.' });
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const fechaIntento = new Date();
        await connection.query(
            'INSERT INTO INTENTO (Fecha, UsuarioCorreo, Calificacion) VALUES (?, ?, ?)',
            [fechaIntento, usuarioCorreo, calificacion]
        );
        const promesasSeleccionar = respuestas.map(r => 
            connection.query(
                'INSERT INTO SELECCIONAR (IntentoFecha, OpcionPreguntaId, OpcionTexto) VALUES (?, ?, ?)',
                [fechaIntento, r.preguntaId, r.opcionTexto]
            )
        );
        await Promise.all(promesasSeleccionar);
        await connection.commit();
        res.status(201).json({ success: true });
    } catch (error) {
        await connection.rollback();
        console.error('Error al guardar el intento:', error);
        res.status(500).json({ error: 'Error interno al guardar el intento.' });
    } finally {
        connection.release();
    }
});


async function generarYGuardarPregunta(criterioId) {
    const connection = await pool.getConnection();
    try {
        console.log(`📌 Obteniendo descripción del criterio ${criterioId}`);
        const [rows] = await connection.query('SELECT Descripcion FROM CRITERIO WHERE Id = ?', [criterioId]);
        if (rows.length === 0) throw new Error(`❌ No se encontró el criterio con ID ${criterioId}.`);

        const descripcion = rows[0].Descripcion;

        const requestBody = {
            messages: [
                {
                    content: "Escribes preguntas tipo test en español que se estructuren en Pregunta:[pregunta], Opciones:[A)... B)... C)... D)...], Opción correcta: [A,B,C o D] y Explicacion:... (sin usar delimitadores)",
                    role: "system"
                },
                {
                    content: `Haz una pregunta acerca de bases de datos con 4 opciones con solo una correcta, que certifique el criterio: '${descripcion}'`,
                    role: "user"
                }
            ]
        };

        console.log(`🔁 Solicitando al LLM para criterio ${criterioId}...`);
        const llmResponse = await axios.post('http://localhost:8000/v1/chat/completions', requestBody, { timeout: 400000 });
        const preguntaCompleta = llmResponse.data.choices[0].message.content;
        console.log(`📩 Respuesta recibida del LLM para criterio ${criterioId}:\n${preguntaCompleta}`);


        // 1. Extraer bloques con soporte flexible

        // Pregunta: busca etiqueta "Pregunta:" o una línea que comience con "¿" y termine en "?"
        const preguntaMatch =
            preguntaCompleta.match(/Pregunta:\s*([\s\S]*?)(?=\n|Opciones?:|A\)|B\)|C\)|D\))/i) ||
            preguntaCompleta.match(/^(¿[\s\S]*?\?)(?=\n|A\)|B\)|C\)|D\))/i);

        // Opciones: detecta el bloque entre A) y justo antes de "Opción correcta:"
        const opcionesMatch = preguntaCompleta.match(/(?:Opciones:)?\s*([\s\S]*?)(?=Op(?:ci[oó]n)?\s*correcta:)/i);

        // Opción correcta y explicación
        const opcionCorrectaMatch = preguntaCompleta.match(/Op(?:ci[oó]n)?\s*correcta:\s*([A-D])/i);
        const explicacionMatch = preguntaCompleta.match(/Explicaci[oó]n:\s*([\s\S]*)/i);

        // 2. Limpiar los campos
        const enunciado = preguntaMatch
            ? preguntaMatch[1].replace(/^¿/, '').replace(/\?$/, '').trim()
            : null;

        const opcionesTexto = opcionesMatch ? opcionesMatch[1].trim() : null;
        const opcionCorrectaLetra = opcionCorrectaMatch ? opcionCorrectaMatch[1].toUpperCase() : null;
        const explicacion = explicacionMatch ? explicacionMatch[1].trim() : '';

        // --- Validación ---
        if (!enunciado || !opcionesTexto || !opcionCorrectaLetra) {
            throw new Error(`Error parseando la respuesta del LLM. Faltan partes esenciales.`);
        }

        // 3. Procesar las opciones, que deben venir como A) ..., B) ..., etc.
        const opciones = [];
        const opcionRegex = /([A-D])\)\s*(.*?)(?=(?:\s*[A-D]\)\s*)|$)/g;
        let match;
        while ((match = opcionRegex.exec(opcionesTexto)) !== null) {
            opciones.push(match[2].trim());
        }



        // --- Guardado en Base de Datos ---
        await connection.beginTransaction();
        const [preguntaResult] = await connection.query(
            'INSERT INTO PREGUNTA (Enunciado, CriterioId, Explicacion) VALUES (?, ?, ?)',
            [enunciado, criterioId, explicacion]
        );
        const preguntaId = preguntaResult.insertId;
        console.log(`✅ Pregunta insertada con ID ${preguntaId} para criterio ${criterioId}`);

        const promesasOpciones = opciones.slice(0, 4).map((opcion, index) => {
            const esCorrecta = opcionCorrectaLetra === String.fromCharCode(65 + index);
            return connection.query(
                'INSERT INTO OPCION (PreguntaId, Texto, Correcta, Calificacion) VALUES (?, ?, ?, ?)',
                [preguntaId, opcion, esCorrecta, esCorrecta ? 1.0 : 0.0]
            );
        });

        await Promise.all(promesasOpciones);
        await connection.commit();
        console.log(`✅ Opciones insertadas para pregunta ${preguntaId}`);

    } catch (error) {
        await connection.rollback();
        console.error(`💥 Error generando pregunta para criterio ${criterioId}:`, error.message);
        // Propagamos el error para que Promise.allSettled lo capture y la orquestación continúe.
        throw error;
    } finally {
        connection.release();
    }
}


async function generarPreguntasParaHistoria(historiaId) {
    const taskFilePath = path.join(TASKS_DIR, `${historiaId}.json`);
    console.log(`[ASYNC] Iniciando generación para la historia ${historiaId}...`);
    try {
        const [criterios] = await pool.query('SELECT Id FROM CRITERIO WHERE HistoriaId = ?', [historiaId]);
        if (criterios.length === 0) {
            console.log(`[ASYNC] No se encontraron criterios para la historia ${historiaId}.`);
            await fs.writeFile(taskFilePath, JSON.stringify({ status: 'COMPLETADO' }));
            return;
        }

        const promesasGeneracion = criterios.map(criterio => generarYGuardarPregunta(criterio.Id));
        const resultados = await Promise.allSettled(promesasGeneracion);

        resultados.forEach((resultado, index) => {
            const criterioId = criterios[index].Id;
            if (resultado.status === 'fulfilled') {
                console.log(`✅ Pregunta generada correctamente para criterio ${criterioId}`);
            } else {
                console.error(`❌ Error generando pregunta para criterio ${criterioId}:`, resultado.reason);
            }
        });


        console.log(`[ASYNC] Generación para historia ${historiaId} completada.`);
        await fs.writeFile(taskFilePath, JSON.stringify({ status: 'COMPLETADO' }));
    } catch (error) {
        console.error(`[ASYNC] Error en la orquestación para la historia ${historiaId}:`, error);
        await fs.writeFile(taskFilePath, JSON.stringify({ status: 'ERROR' }));
    }
}

app.post('/api/historias/:historiaId/generar-preguntas', async (req, res) => {
    const { historiaId } = req.params;
    const taskFilePath = path.join(TASKS_DIR, `${historiaId}.json`);
    try {
        const [[historia]] = await pool.query('SELECT Id FROM HISTORIA WHERE Id = ?', [historiaId]);
        if (!historia) return res.status(404).json({ error: 'Historia no encontrada' });

        await fs.writeFile(taskFilePath, JSON.stringify({ status: 'EN_PROCESO', startTime: Date.now() }));
        res.status(202).json({ message: 'La generación de preguntas ha comenzado.' });
        console.log(`▶️ Llamando a generarPreguntasParaHistoria(${historiaId})`);
        try {
    await generarPreguntasParaHistoria(historiaId);
} catch (err) {
    console.error(`💥 Error inesperado en llamada asincrónica:`, err);
}


    } catch (error) {
        console.error(`Error al iniciar la generación para la historia ${historiaId}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/api/historias/:historiaId/estado-generacion', async (req, res) => {
    const { historiaId } = req.params;
    const taskFilePath = path.join(TASKS_DIR, `${historiaId}.json`);

    try {
        const data = await fs.readFile(taskFilePath, 'utf8');
        const task = JSON.parse(data);

        if (task.status === 'EN_PROCESO' && (Date.now() - task.startTime > TASK_TIMEOUT)) {
            console.warn(`La tarea para la historia ${historiaId} ha superado el tiempo máximo (10 minutos).`);
            await fs.unlink(taskFilePath);
            return res.status(408).json({ status: 'TIMEOUT', message: 'La tarea ha tardado demasiado.' });
        }

        if (task.status === 'COMPLETADO') {
            res.json({ status: 'COMPLETADO' });
            await fs.unlink(taskFilePath);
        } else if (task.status === 'ERROR') {
            res.status(500).json({ status: 'ERROR', message: 'La generación falló en el servidor.' });
            await fs.unlink(taskFilePath);
        } else {
            res.json({ status: 'PENDIENTE' });
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.json({ status: 'PENDIENTE' });
        }
        console.error(`Error al leer el estado para la historia ${historiaId}:`, error);
        res.status(500).json({ error: 'Error del servidor al comprobar el estado.' });
    }
});

app.get('/api/historias/:historiaId/stats', async (req, res) => {
    const { historiaId } = req.params;
    const usuarioCorreo = 'usuario@ejemplo.com'; // Usar el usuario autenticado en un sistema real

    try {
        // 1. Contar el número total de preguntas para esta historia.
        const [totalResult] = await pool.query(`
            SELECT COUNT(p.Id) as totalPreguntas
            FROM PREGUNTA p
            JOIN CRITERIO c ON p.CriterioId = c.Id
            WHERE c.HistoriaId = ?
        `, [historiaId]);

        const totalPreguntas = totalResult[0].totalPreguntas;

        // 2. Contar cuántas preguntas únicas ha respondido el usuario para esta historia.
        const [answeredResult] = await pool.query(`
            SELECT COUNT(DISTINCT p.Id) as preguntasRespondidas
            FROM SELECCIONAR s
            JOIN INTENTO i ON s.IntentoFecha = i.Fecha
            JOIN PREGUNTA p ON s.OpcionPreguntaId = p.Id
            JOIN CRITERIO c ON p.CriterioId = c.Id
            WHERE i.UsuarioCorreo = ? AND c.HistoriaId = ?
        `, [usuarioCorreo, historiaId]);

        const preguntasRespondidas = answeredResult[0].preguntasRespondidas;

        // 3. Devolver los datos en el formato que espera el frontend.
        res.json({
            totalPreguntas,
            preguntasRespondidas
        });

    } catch (error) {
        console.error(`Error al obtener las estadísticas para la historia ${historiaId}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/api/objetivos/:objetivoId/stats', async (req, res) => {
    const { objetivoId } = req.params;
    // En un sistema real, obtendrías el correo del usuario a través de un token de autenticación.
    const usuarioCorreo = 'usuario@ejemplo.com';

    try {
        // 1. Contar el número total de preguntas para este objetivo.
        // Se une PREGUNTA -> CRITERIO -> HISTORIA para filtrar por ObjetivoId.
        const [totalResult] = await pool.query(`
            SELECT COUNT(p.Id) as totalPreguntas
            FROM PREGUNTA p
            JOIN CRITERIO c ON p.CriterioId = c.Id
            JOIN HISTORIA h ON c.HistoriaId = h.Id
            WHERE h.ObjetivoId = ?
        `, [objetivoId]);

        const totalPreguntas = totalResult[0].totalPreguntas;

        // 2. Contar cuántas preguntas únicas ha respondido el usuario para este objetivo.
        const [answeredResult] = await pool.query(`
            SELECT COUNT(DISTINCT p.Id) as preguntasRespondidas
            FROM SELECCIONAR s
            JOIN INTENTO i ON s.IntentoFecha = i.Fecha
            JOIN PREGUNTA p ON s.OpcionPreguntaId = p.Id
            JOIN CRITERIO c ON p.CriterioId = c.Id
            JOIN HISTORIA h ON c.HistoriaId = h.Id
            WHERE i.UsuarioCorreo = ? AND h.ObjetivoId = ?
        `, [usuarioCorreo, objetivoId]);

        const preguntasRespondidas = answeredResult[0].preguntasRespondidas;

        // 3. Devolver los datos en el formato que espera el frontend.
        res.json({
            totalPreguntas: totalPreguntas,
            preguntasRespondidas: preguntasRespondidas
        });

    } catch (error) {
        console.error(`Error al obtener las estadísticas para el objetivo ${objetivoId}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});




















// Inicia el servidor
app.listen(port, async () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
  await ensureTestUserExists();
});
