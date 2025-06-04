// server.js

// --- Importar Módulos ---
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// --- Configuração Inicial ---
const app = express();
const server = http.createServer(app);
// Cria um novo servidor Socket.IO, anexando-o ao servidor HTTP
const io = new Server(server);

// Define a porta do servidor, usando a variável de ambiente ou a porta 3000 por padrão
const PORT = process.env.PORT || 3000;

// Serve arquivos estáticos da pasta 'public' (seu frontend)
app.use(express.static('public'));

// --- Lógica do Jogo Multi-jogador ---

// Estruturas de dados do jogo
let players = []; // Lista de jogadores conectados: [{ id: 'socketid', name: 'Nome', score: 0, totalTime: 0 }]
let gameStarted = false;
let gamePhase = 'lobby'; // 'lobby', 'in-game', 'results'
let lobbyTimer = 60; // 1 minuto para o lobby
let gameTimer = 60; // 1 minuto de jogo
let currentChallenge = {}; // Desafio Stroop atual
let challengeStartTime; // Timestamp quando o desafio atual começou
let challengeCount = 0; // Contador de desafios para controlar as fases
const MAX_CHALLENGES = 5; // Número total de desafios

// Definição dos desafios Stroop (mesmos do frontend, mas gerenciados pelo backend)
const challenges = [
    { text: 'AMARELO', displayColor: 'yellow', correctColor: 'yellow' },
    { text: '青', displayColor: 'blue', correctColor: 'blue' }, // "Azul" em japonês
    { text: 'VERMELHO', display: 'VERMELHO', displayColor: 'green', correctColor: 'green' }, // Texto 'VERMELHO' com cor verde
    { text: 'AMARELO', display: 'AMARELO', displayColor: 'red', correctColor: 'red' }, // Texto 'AMARELO' com cor vermelha
    { text: 'AZUL', display: 'AZUL', displayColor: 'green', correctColor: 'green', fontSize: '0.8em' } // Texto 'AZUL' com cor verde e fonte pequena
];

// --- Funções de Sincronização do Jogo ---

/**
 * Inicia o temporizador do lobby.
 */
function startLobbyTimerInterval() {
    console.log('Lobby timer started');
    lobbyTimer = 60; // Resetar
    io.emit('lobbyState', { timer: lobbyTimer, players: players.map(p => p.name) }); // Envia estado inicial

    const lobbyInterval = setInterval(() => {
        lobbyTimer--;
        io.emit('lobbyState', { timer: lobbyTimer, players: players.map(p => p.name) });

        if (lobbyTimer <= 0) {
            clearInterval(lobbyInterval);
            if (players.length > 0) {
                startGame();
            } else {
                console.log('No players in lobby, restarting lobby timer...');
                startLobbyTimerInterval(); // Reinicia o lobby se não houver jogadores
            }
        }
    }, 1000);
}

/**
 * Inicia o jogo principal.
 */
function startGame() {
    gameStarted = true;
    gamePhase = 'in-game';
    challengeCount = 0; // Reseta o contador de desafios
    players.forEach(p => { // Reseta scores dos jogadores para o novo jogo
        p.score = 0;
        p.totalTime = 0;
    });

    console.log('Game started!');
    io.emit('gameStart'); // Notifica todos os clientes que o jogo começou
    sendNextChallenge(); // Envia o primeiro desafio
}

/**
 * Envia o próximo desafio ou encerra o jogo se todos os desafios foram apresentados.
 */
function sendNextChallenge() {
    if (challengeCount < MAX_CHALLENGES) {
        currentChallenge = challenges[challengeCount]; // Pega o desafio na ordem das fases
        challengeStartTime = Date.now(); // Marca o tempo de início do desafio
        
        // Envia apenas os dados necessários para o frontend exibir o desafio
        io.emit('newChallenge', {
            text: currentChallenge.text,
            displayColor: currentChallenge.displayColor,
            fontSize: currentChallenge.fontSize // Pode ser undefined, mas será tratado no frontend
        });
        console.log(`Sending challenge ${challengeCount + 1}: ${currentChallenge.text} in ${currentChallenge.displayColor}`);
        challengeCount++;
        // Iniciar um temporizador para o desafio individual, caso um jogador demore muito
        // (Isso é opcional, o jogo original do Kahoot tem um timer por questão)
        // setTimeout(() => { if (players.some(p => p.score < challengeCount)) console.log("Some players haven't answered yet"); }, 10000); // Exemplo
    } else {
        endGame();
    }
}

/**
 * Finaliza o jogo e calcula o ranking.
 */
function endGame() {
    gameStarted = false;
    gamePhase = 'results';
    console.log('Game ended. Calculating ranking...');

    // Calcula o ranking: mais acertos, menor tempo total
    const ranking = [...players].sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score; // Ordem decrescente de acertos
        }
        return a.totalTime - b.totalTime; // Ordem crescente de tempo total (se acertos iguais)
    });

    io.emit('gameEnd', { ranking: ranking.map(p => ({ name: p.name, score: p.score, totalTime: p.totalTime })) });
    console.log('Ranking:', ranking);

    // Reinicia o lobby após um tempo para permitir novo jogo
    setTimeout(() => {
        console.log('Restarting lobby for a new game...');
        gamePhase = 'lobby';
        startLobbyTimerInterval();
    }, 10000); // 10 segundos para ver os resultados antes de reiniciar o lobby
}

// --- Eventos de Conexão Socket.IO ---

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Quando um jogador tenta entrar no jogo
    socket.on('joinGame', (playerNameInput) => {
        const name = playerNameInput.trim();
        if (!name || players.some(p => p.id === socket.id)) {
            console.log('Invalid name or player already joined.');
            return;
        }

        const newPlayer = {
            id: socket.id,
            name: name,
            score: 0,
            totalTime: 0 // Tempo total de resposta
        };
        players.push(newPlayer);
        console.log(`${name} (${socket.id}) joined the game.`);

        // Envia o estado atual do lobby para o novo jogador e todos os outros
        io.emit('lobbyState', { timer: lobbyTimer, players: players.map(p => p.name) });

        // Se for o primeiro jogador, inicia o temporizador do lobby
        if (players.length === 1 && !gameStarted) {
            startLobbyTimerInterval();
        } else if (gameStarted) {
            // Se o jogo já começou, o novo jogador não pode entrar ou precisa esperar
            // Aqui, enviamos ele para a tela de resultados ou pedimos para esperar.
            // Para simplicidade, vamos apenas forçar ele a esperar a próxima rodada.
            socket.emit('gameAlreadyStarted', 'O jogo já começou. Aguarde a próxima rodada.');
        }
    });

    // Quando um jogador clica em uma resposta
    socket.on('submitAnswer', (clickedColor) => {
        const player = players.find(p => p.id === socket.id);

        if (!player || !gameStarted || !currentChallenge || !challengeStartTime) {
            return; // Ignora respostas inválidas
        }

        // Calcula o tempo de resposta
        const responseTime = Date.now() - challengeStartTime;

        if (clickedColor === currentChallenge.correctColor) {
            player.score++;
            player.totalTime += responseTime; // Adiciona o tempo à contagem total
            console.log(`${player.name} (${player.id}) ACERTOU! Score: ${player.score}, Tempo: ${responseTime}ms`);
            // Em um jogo Kahoot, você enviaria a próxima questão para TODOS após UM TEMPO LIMITE
            // ou quando TODOS responderam. Para o teste Stroop, vamos manter a lógica de avançar
            // após um acerto do jogador para que ele continue o teste.
            // No entanto, para MULTIPLAYER, a questão deve avançar para TODOS.
            // Simplificando: a questão avança quando *todos* os jogadores ativos responderam ou um tempo limite global da questão.
            // Para o seu modelo, faremos a questão avançar para TODOS, mas cada um tem seu score.
            // Para isso, precisamos de uma lógica que espere por todas as respostas ou um timeout.

            // Para este exemplo, faremos um avanço de desafio simplificado:
            // O próximo desafio é enviado para todos quando o último jogador da rodada responde.
            // OU quando o tempo de resposta da rodada global se esgota (o que seria mais Kahoot-like).
            // Vamos optar por avançar para o próximo desafio *quando todos os jogadores ativos responderam* ou *um timeout global* (que não implementamos aqui para cada desafio, apenas o geral de 60s).
            // Para manter a sequência de fases (5 no total), a próxima fase é enviada.

            // Marcamos que este jogador respondeu o desafio atual
            // (Para um controle mais rigoroso, cada desafio deveria ter um estado 'answeredPlayers' para cada jogador)
            socket.emit('answerResult', { correct: true, score: player.score });

            // Se todos os jogadores (ou um subconjunto significativo) responderam, avançar para a próxima fase.
            // Para manter a simplicidade neste exemplo, vamos apenas enviar o próximo desafio
            // uma vez que todos os jogadores ativos respondam ou um timeout global para a fase.
            // O ideal seria esperar por todas as respostas de `challengeCount`
            // Por simplicidade aqui, cada jogador avança o contador local, mas o desafio GLOBAL
            // só avança para TODOS quando `sendNextChallenge` é chamado (por um timer ou por todas as respostas).

            // Lógica para avançar a fase GLOBAL:
            // Quando todos os jogadores tiverem enviado uma resposta para o currentChallenge,
            // ou após um tempo limite para a questão, o servidor deve chamar `sendNextChallenge()` novamente.
            // Para este exemplo, vamos manter a fase avançando a cada acerto *do jogador*, o que não é Kahoot-like.
            // Para ser Kahoot-like, o servidor deveria *esperar* as respostas de todos ou um timer.
            // Vamos mudar para uma lógica mais Kahoot-like: o servidor avança a fase para todos.
            // Para isso, o `sendNextChallenge` precisa ser chamado por um timer global ou quando todos responderem.
            // **Implementação simplificada para o teste Stroop em grupo:**
            // A cada acerto, o jogador aumenta sua pontuação. O `sendNextChallenge` é chamado *quando a rodada global avança*.
            // Por enquanto, faremos o `sendNextChallenge` ser chamado *após um curto delay* após *qualquer* acerto
            // para simular um avanço, mas o ideal seria após todos responderem ou um timer.
            
            // Para o seu caso, a lógica mais precisa seria:
            // 1. Servidor envia um desafio (newChallenge).
            // 2. Todos os jogadores respondem (submitAnswer).
            // 3. Servidor espera X segundos OU todas as respostas.
            // 4. Servidor envia o próximo desafio (newChallenge).
            // Isso requer um array de respostas por desafio.

            // Por causa da complexidade de gerenciar "respostas de todos" por desafio e timers,
            // vamos fazer uma versão híbrida: os jogadores pontuam individualmente.
            // A *sequência de fases* é gerenciada pelo backend, e um novo desafio é enviado para todos
            // após um pequeno atraso, simulando a transição de questão do Kahoot.
            // Para simular as fases uma por uma, vamos chamar sendNextChallenge após um delay.

            // Se esta resposta é a última do desafio atual (ou depois de um tempo limite do desafio)
            // Para este exemplo, apenas avançaremos o desafio para o jogador que acertou,
            // mas o desafio global para todos os jogadores *deve* avançar.
            // Vamos adicionar um temporizador global para avançar as fases.

            // REMOVED: generateChallenge() from frontend, as backend will control phases for all.
            // The `sendNextChallenge` will be called by a global timer.
        } else {
            console.log(`${player.name} (${player.id}) ERROU.`);
            socket.emit('answerResult', { correct: false, score: player.score });
        }
    });

    // Quando um jogador se desconecta
    socket.on('disconnect', () => {
        const disconnectedPlayer = players.find(p => p.id === socket.id);
        if (disconnectedPlayer) {
            players = players.filter(p => p.id !== socket.id);
            console.log(`${disconnectedPlayer.name} (${socket.id}) disconnected.`);
            io.emit('lobbyState', { timer: lobbyTimer, players: players.map(p => p.name) }); // Atualiza lobby
            if (players.length === 0 && gameStarted) {
                console.log('All players disconnected, ending game.');
                endGame(); // Opcional: encerrar o jogo se todos saírem
            }
        } else {
            console.log('A user disconnected:', socket.id);
        }
    });
});

// --- Início do Servidor ---
server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    // Inicia o temporizador do lobby assim que o servidor é iniciado
    startLobbyTimerInterval();
});

// --- Temporizador Global para Avançar Fases (Kahoot-like) ---
// Este timer forçará o avanço para o próximo desafio a cada X segundos,
// independentemente de todos terem respondido.
// Para um Stroop puro, o ideal é que cada um faça as fases no seu ritmo,
// mas para o "Kahoot-like", as fases precisam avançar para todos.
let phaseAdvanceInterval;
function startPhaseAdvanceTimer() {
    if (phaseAdvanceInterval) clearInterval(phaseAdvanceInterval); // Limpa qualquer timer anterior
    phaseAdvanceInterval = setInterval(() => {
        if (gameStarted && gamePhase === 'in-game') {
            sendNextChallenge(); // Envia o próximo desafio para todos
        }
    }, 10000); // Avança para a próxima fase a cada 10 segundos
}

// Inicia o timer de avanço de fase quando o jogo começar
io.on('gameStart', startPhaseAdvanceTimer); // Este é um evento do backend para o backend

// Limpa o timer de avanço de fase quando o jogo termina
io.on('gameEnd', () => {
    if (phaseAdvanceInterval) {
        clearInterval(phaseAdvanceInterval);
    }
});
