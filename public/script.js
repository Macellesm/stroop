// script.js (Frontend atualizado)

// --- Seleção de Elementos HTML (permanece igual) ---
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const resultsScreen = document.getElementById('results-screen');

const playerNameInput = document.getElementById('player-name-input');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');

const lobbyTimerDisplay = document.getElementById('lobby-timer');
const playersInLobbyList = document.getElementById('players-in-lobby');

const challengeText = document.getElementById('challenge-text');
const timerDisplay = document.getElementById('timer'); // Será o timer da questão, ou tempo total de jogo
const scoreDisplay = document.getElementById('score');
const colorButtons = document.querySelectorAll('.color-button');

const finalScoreDisplay = document.getElementById('final-score');
const rankingList = document.getElementById('ranking-list');

// --- Variáveis de Estado do Jogo (Ajustadas para Backend) ---
let playerName = '';
let score = 0; // Sua pontuação local
let totalTime = 0; // Seu tempo total de resposta
let currentChallenge = {}; // Desafio atual enviado pelo backend
let responseStartTime; // Tempo em que o desafio apareceu (para calcular tempo de resposta)

// Socket.IO Connection
const socket = io(); // Conecta ao servidor Socket.IO

// --- Funções de Controle de Tela (permanece igual) ---
function showScreen(screenToShow) {
    startScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    resultsScreen.classList.remove('active');
    screenToShow.classList.add('active');
}

// --- Funções para Interação com o Backend ---

/**
 * Envia o nome do jogador para o servidor para entrar no jogo.
 */
function joinGame() {
    playerName = playerNameInput.value.trim();
    if (!playerName) {
        alert('Por favor, digite seu nome para começar!');
        return;
    }
    socket.emit('joinGame', playerName);
    // showScreen(startScreen); // Permanece na tela de início para ver o lobby
}

/**
 * Lida com o clique do jogador em um dos botões de cor e envia a resposta para o servidor.
 * @param {Event} event - O evento de clique do botão.
 */
function handleButtonClick(event) {
    const clickedColor = event.target.dataset.color;
    if (currentChallenge.correctColor) { // Certifica-se de que há um desafio ativo
        const responseTime = Date.now() - responseStartTime;
        socket.emit('submitAnswer', clickedColor); // Envia apenas a cor para o backend
        // O backend lidará com a lógica de acerto/erro e pontuação
        // totalTime += responseTime; // O backend vai gerenciar o totalTime
        // score++; // O backend vai gerenciar o score
    }
}

// --- Eventos de Conexão e Recebimento do Servidor ---

socket.on('connect', () => {
    console.log('Conectado ao servidor Socket.IO:', socket.id);
});

socket.on('disconnect', () => {
    console.log('Desconectado do servidor Socket.IO');
});

// Recebe o estado do lobby do servidor
socket.on('lobbyState', (data) => {
    showScreen(startScreen); // Garante que a tela de início esteja visível
    lobbyTimerDisplay.textContent = data.timer;
    playersInLobbyList.innerHTML = ''; // Limpa a lista
    data.players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player;
        playersInLobbyList.appendChild(li);
    });
    console.log('Lobby State:', data);
});

// Notificação de que o jogo já começou (se tentar entrar tarde)
socket.on('gameAlreadyStarted', (message) => {
    alert(message);
    playerNameInput.value = ''; // Limpa o campo de nome
    showScreen(startScreen); // Volta para a tela inicial
});


// Quando o servidor sinaliza o início do jogo
socket.on('gameStart', () => {
    console.log('Jogo começou!');
    showScreen(gameScreen);
    score = 0; // Zera score localmente para o novo jogo
    totalTime = 0; // Zera tempo localmente
    scoreDisplay.textContent = `Acertos: ${score}`;
    timerDisplay.textContent = `Tempo: ${gameTimeLeft}s`; // Reinicializa o timer na tela do jogo
    // O timer da questão ou o timer geral do jogo será enviado pelo backend.
});

// Quando o servidor envia um novo desafio
socket.on('newChallenge', (challengeData) => {
    currentChallenge = challengeData; // Armazena o desafio
    responseStartTime = Date.now(); // Marca o início do tempo de resposta
    
    // Atualiza o texto e a cor do desafio
    challengeText.innerHTML = `<span style="color: ${challengeData.displayColor}; font-size: ${challengeData.fontSize || 'inherit'};">${challengeData.text}</span>`;
    
    console.log('Novo desafio:', challengeData);
});

// Recebe o resultado da sua resposta do servidor
socket.on('answerResult', (data) => {
    // Atualiza a pontuação local do jogador com a pontuação validada pelo servidor
    score = data.score;
    scoreDisplay.textContent = `Acertos: ${score}`;
    // O tempo de resposta individual não será exibido em tempo real, mas o score sim.
    if (!data.correct) {
        console.log("Você errou! Sua pontuação não mudou.");
    }
});

// Quando o jogo termina
socket.on('gameEnd', (data) => {
    console.log('Jogo terminou! Ranking:', data.ranking);
    finalScoreDisplay.textContent = `Parabéns, ${playerName}! Sua pontuação final: ${score} acertos.`;
    
    // Exibe o ranking global
    rankingList.innerHTML = '';
    if (data.ranking.length === 0) {
        rankingList.innerHTML = '<li>Nenhum resultado.</li>';
    } else {
        data.ranking.forEach((player, index) => {
            const li = document.createElement('li');
            // Formata o tempo total para segundos e milissegundos
            const totalSeconds = (player.totalTime / 1000).toFixed(2);
            li.textContent = `${index + 1}. ${player.name}: ${player.score} acertos (${totalSeconds}s)`;
            rankingList.appendChild(li);
        });
    }
    showScreen(resultsScreen);
});

// --- Event Listeners (Ajustados) ---
startButton.addEventListener('click', joinGame); // Agora chama joinGame
restartButton.addEventListener('click', () => {
    playerNameInput.value = ''; // Limpa o nome para uma nova partida
    socket.emit('joinGame', playerName); // Tenta entrar novamente no lobby
});

colorButtons.forEach(button => {
    button.addEventListener('click', handleButtonClick);
});

// --- Inicialização ---
showScreen(startScreen); // Inicia na tela de início
