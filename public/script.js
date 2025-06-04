// script.js

// --- Seleção de Elementos HTML ---
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const resultsScreen = document.getElementById('results-screen');

const playerNameInput = document.getElementById('player-name-input');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');

const lobbyTimerDisplay = document.getElementById('lobby-timer');
const playersInLobbyList = document.getElementById('players-in-lobby');

const challengeText = document.getElementById('challenge-text');
const timerDisplay = document.getElementById('timer');
const scoreDisplay = document.getElementById('score');
const colorButtons = document.querySelectorAll('.color-button'); // Seleciona todos os botões de cor

const finalScoreDisplay = document.getElementById('final-score');
const rankingList = document.getElementById('ranking-list');

// --- Variáveis de Estado do Jogo ---
let playerName = '';
let score = 0;
let gameTimeLeft = 60; // Tempo total de jogo em segundos
let lobbyTimeLeft = 60; // Tempo para o lobby em segundos (1 minuto)
let gameInterval; // Para o temporizador do jogo
let lobbyInterval; // Para o temporizador do lobby
let currentChallenge = {}; // Armazena o desafio atual
let localRanking = JSON.parse(localStorage.getItem('stroopRanking')) || []; // Carrega ranking do armazenamento local

// Definição dos desafios Stroop
// Cada objeto tem:
//   - text: O texto que será exibido.
//   - displayColor: A cor com que o 'text' será renderizado.
//   - correctColor: A cor que o jogador DEVE clicar.
//   - fontSize: (Opcional) Ajuste de tamanho da fonte para desafios específicos.
const challenges = [
    { text: 'AMARELO', displayColor: 'yellow', correctColor: 'yellow' },
    { text: '青', displayColor: 'blue', correctColor: 'blue' }, // "Azul" em japonês
    { text: 'VERMELHO', displayColor: 'green', correctColor: 'green' },
    { text: 'AMARELO', displayColor: 'red', correctColor: 'red' },
    { text: 'AZUL', displayColor: 'green', correctColor: 'green', fontSize: '0.8em' } // Fonte menor
];

// --- Funções de Controle de Tela ---
/**
 * Alterna a visibilidade das telas do jogo.
 * @param {HTMLElement} screenToShow - O elemento da tela que deve ser exibido.
 */
function showScreen(screenToShow) {
    // Remove 'active' de todas as telas
    startScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    resultsScreen.classList.remove('active');
    // Adiciona 'active' à tela desejada
    screenToShow.classList.add('active');
}

// --- Funções do Jogo ---

/**
 * Inicia a contagem regressiva do lobby e prepara o jogo.
 */
function startLobbyTimer() {
    lobbyTimeLeft = 60; // Reseta o tempo do lobby
    lobbyTimerDisplay.textContent = lobbyTimeLeft;
    playersInLobbyList.innerHTML = `<li>${playerName} (Você)</li>`; // Adiciona o próprio jogador

    // Este seria o ponto onde um backend real adicionaria outros jogadores
    // Por exemplo, em um cenário real com WebSockets, o servidor enviaria a lista de jogadores

    lobbyInterval = setInterval(() => {
        lobbyTimeLeft--;
        lobbyTimerDisplay.textContent = lobbyTimeLeft;

        if (lobbyTimeLeft <= 0) {
            clearInterval(lobbyInterval);
            startGame(); // Inicia o jogo para todos (neste caso, apenas o jogador local)
        }
    }, 1000);
}

/**
 * Inicia o jogo principal após o lobby.
 */
function startGame() {
    score = 0;
    gameTimeLeft = 60; // Reseta o tempo de jogo
    scoreDisplay.textContent = `Acertos: ${score}`;
    timerDisplay.textContent = `Tempo: ${gameTimeLeft}s`;
    showScreen(gameScreen); // Mostra a tela do jogo
    generateChallenge(); // Gera o primeiro desafio

    gameInterval = setInterval(updateGameTimer, 1000); // Inicia o temporizador do jogo
}

/**
 * Atualiza o temporizador do jogo e verifica o fim do tempo.
 */
function updateGameTimer() {
    gameTimeLeft--;
    timerDisplay.textContent = `Tempo: ${gameTimeLeft}s`;

    if (gameTimeLeft <= 0) {
        endGame(); // Finaliza o jogo quando o tempo acaba
    }
}

/**
 * Gera e exibe um novo desafio Stroop na tela.
 */
function generateChallenge() {
    // Escolhe um desafio aleatoriamente da lista
    const randomIndex = Math.floor(Math.random() * challenges.length);
    currentChallenge = challenges[randomIndex];

    // Cria o HTML para exibir o texto com a cor e o tamanho de fonte corretos
    challengeText.innerHTML = `<span style="color: ${currentChallenge.displayColor}; font-size: ${currentChallenge.fontSize || 'inherit'};">${currentChallenge.text}</span>`;
}

/**
 * Lida com o clique do jogador em um dos botões de cor.
 * @param {Event} event - O evento de clique do botão.
 */
function handleButtonClick(event) {
    const clickedColor = event.target.dataset.color; // Pega a cor do atributo 'data-color' do botão

    if (clickedColor === currentChallenge.correctColor) {
        score++; // Incrementa a pontuação se acertar
        scoreDisplay.textContent = `Acertos: ${score}`;
        generateChallenge(); // Gera um novo desafio
    } else {
        // Opcional: Aqui você poderia adicionar lógica para penalidade por erro,
        // mas no efeito Stroop, geralmente, apenas a não contagem do acerto já é a penalidade.
        // console.log("Errou!");
    }
}

/**
 * Finaliza o jogo, exibe os resultados e atualiza o ranking.
 */
function endGame() {
    clearInterval(gameInterval); // Para o temporizador do jogo
    finalScoreDisplay.textContent = `Parabéns, ${playerName}! Você fez ${score} acertos.`;

    saveRanking(playerName, score); // Salva a pontuação no ranking
    displayRanking(); // Exibe o ranking atualizado

    showScreen(resultsScreen); // Mostra a tela de resultados
}

/**
 * Salva a pontuação do jogador no ranking local (localStorage).
 * @param {string} name - Nome do jogador.
 * @param {number} finalScore - Pontuação final do jogador.
 */
function saveRanking(name, finalScore) {
    localRanking.push({ name: name, score: finalScore }); // Adiciona o novo resultado
    
    // Classifica o ranking: primeiro por maior pontuação, depois por tempo (nesse caso, como o tempo é fixo, só a pontuação importa mais)
    localRanking.sort((a, b) => b.score - a.score);

    // Limita o ranking aos top 10 (ou outro número, se desejar)
    localRanking = localRanking.slice(0, 10);

    // Salva o ranking atualizado no localStorage do navegador
    localStorage.setItem('stroopRanking', JSON.stringify(localRanking));
}

/**
 * Exibe o ranking atual na tela de resultados.
 */
function displayRanking() {
    rankingList.innerHTML = ''; // Limpa a lista existente

    if (localRanking.length === 0) {
        rankingList.innerHTML = '<li>Nenhum resultado ainda. Jogue para aparecer aqui!</li>';
        return;
    }

    localRanking.forEach((player, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${player.name}: ${player.score} acertos`;
        rankingList.appendChild(li);
    });
}

// --- Event Listeners (Ouvintes de Eventos) ---

// Ao clicar no botão "Começar" na tela inicial
startButton.addEventListener('click', () => {
    playerName = playerNameInput.value.trim(); // Pega o nome digitado
    if (!playerName) {
        alert('Por favor, digite seu nome para começar!');
        return;
    }
    // Mostra a tela de início do lobby e inicia o temporizador
    showScreen(startScreen); // Mantém na tela de início para mostrar o timer do lobby
    startLobbyTimer();
});

// Ao clicar em qualquer botão de cor durante o jogo
colorButtons.forEach(button => {
    button.addEventListener('click', handleButtonClick);
});

// Ao clicar no botão "Jogar Novamente" na tela de resultados
restartButton.addEventListener('click', () => {
    playerNameInput.value = ''; // Limpa o campo de nome
    showScreen(startScreen); // Volta para a tela inicial
    clearInterval(lobbyInterval); // Garante que o timer do lobby não esteja rodando
    lobbyTimerDisplay.textContent = 60; // Reseta a exibição do timer do lobby
    playersInLobbyList.innerHTML = ''; // Limpa a lista de jogadores no lobby
});

// --- Inicialização ---
// Exibe o ranking quando a página é carregada pela primeira vez
displayRanking();
