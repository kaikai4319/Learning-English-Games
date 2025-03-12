class WordGame {
    constructor() {
        this.gameContainer = document.getElementById('gameContainer');
        this.wordListManager = document.getElementById('wordListManager');
        this.wordsArea = document.getElementById('wordsArea');
        this.definitionsArea = document.getElementById('definitionsArea');
        this.scoreElement = document.getElementById('score');
        this.pauseBtn = document.getElementById('pauseBtn');
        
        this.words = [];
        this.score = 0;
        this.selectedWord = null;
        this.selectedDefinition = null;
        this.isPaused = false;
        this.displayCount = 5; // 一次显示5组单词
        this.currentWords = []; // 当前显示的单词
        this.wordAppearances = new Map(); // 记录每个单词出现的次数
        this.favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        this.favoriteList = document.getElementById('favoriteList');
        this.toggleFavoriteBtn = document.getElementById('toggleFavoriteBtn');
        this.processingTimeout = null;  // 添加一个超时处理器变量

        this.initializeGame();
    }

    initializeGame() {
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        this.toggleFavoriteBtn.addEventListener('click', () => this.toggleFavoriteList());
    }

    startGame() {
        if (!window.wordList.currentWords || window.wordList.currentWords.length === 0) {
            alert('请先添加单词！');
            return;
        }

        // 初始化单词出现次数记录
        this.wordAppearances.clear();
        
        // 使用当前显示的单词
        window.wordList.currentWords.forEach(word => {
            this.wordAppearances.set(word.word, 0);
        });
        
        this.words = this.prepareGameWords(window.wordList.currentWords);
        this.score = 0;
        this.updateScore();
        this.wordListManager.classList.add('hidden');
        this.gameContainer.classList.remove('hidden');
        this.displayWords();
    }

    prepareGameWords(originalWords) {
        // 创建初始单词池
        return this.shuffleArray([...originalWords]);
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    displayWords() {
        // 检查是否需要补充单词池
        this.replenishWordPool();
        
        // 如果当前显示的单词数小于5且还有未显示的单词，则添加新单词
        while (this.currentWords.length < this.displayCount && this.words.length > 0) {
            this.currentWords.push(this.words.shift());
        }

        // 如果没有更多单词可显示且当前也没有单词，则游戏结束
        if (this.currentWords.length === 0) {
            this.endGame();
            return;
        }

        // 重新显示所有当前单词
        this.wordsArea.innerHTML = '';
        this.definitionsArea.innerHTML = '';

        // 打乱释义的顺序
        const shuffledDefinitions = this.shuffleArray([...this.currentWords]);

        // 为每个单词分配位置
        this.currentWords.forEach((word, index) => {
            const wordElement = this.createCard(word.word, 'word');
            wordElement.classList.add(`position-${index + 1}`);
            this.wordsArea.appendChild(wordElement);
        });

        // 为释义分配随机位置
        const positions = Array.from({ length: this.displayCount }, (_, i) => i + 1);
        this.shuffleArray(positions);
        
        shuffledDefinitions.forEach((word, index) => {
            const definitionElement = this.createCard(word.definition, 'definition');
            definitionElement.classList.add(`position-${positions[index]}`);
            this.definitionsArea.appendChild(definitionElement);
        });
    }

    createCard(text, type) {
        const card = document.createElement('div');
        card.className = `${type}-card`;
        // 创建文本节点
        const textNode = document.createTextNode(text);
        card.appendChild(textNode);
        
        // 只给单词卡片添加收藏按钮和发音功能
        if (type === 'word') {
            const favoriteBtn = document.createElement('button');
            favoriteBtn.className = 'favorite-btn' + 
                (this.isWordFavorited(text) ? ' active' : '');
            favoriteBtn.innerHTML = '★';
            favoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFavorite(text);
            });
            card.appendChild(favoriteBtn);
            
            // 添加发音按钮
            const speakBtn = document.createElement('button');
            speakBtn.className = 'speak-btn card-speak-btn';
            speakBtn.title = '播放发音';
            speakBtn.innerHTML = '🔊';
            speakBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.speakWord(text);
            });
            card.appendChild(speakBtn);
            
            // 分离发音和点击处理
            card.addEventListener('mousedown', () => {
                // 立即播放发音
                this.speakWord(text);
            });
            card.addEventListener('click', () => {
                this.handleCardClick(card, type, text);
            });
        } else {
            card.addEventListener('click', () => this.handleCardClick(card, type, text));
        }
        
        return card;
    }

    handleCardClick(card, type, text) {
        if (this.isPaused) return;

        // 如果正在处理匹配且点击的是释义卡片，则忽略点击
        if (this.isProcessingMatch) {
            return;
        }

        if (type === 'word') {
            if (this.selectedWord) {
                this.selectedWord.classList.remove('selected');
            }
            this.selectedWord = card;
            card.classList.add('selected');
        } else {
            if (this.selectedDefinition) {
                this.selectedDefinition.classList.remove('selected');
            }
            this.selectedDefinition = card;
            card.classList.add('selected');
        }

        if (this.selectedWord && this.selectedDefinition) {
            this.checkMatch();
        }
    }

    checkMatch() {
        // 如果已经在处理匹配，则忽略新的匹配检查
        if (this.isProcessingMatch) {
            // 清除之前的选择
            if (this.selectedDefinition) {
                this.selectedDefinition.classList.remove('selected');
            }
            this.selectedDefinition = null;
            return;
        }
        
        // 获取单词文本（去掉收藏按钮的文本）
        const wordText = this.selectedWord.childNodes[0].textContent.trim();
        const word = this.currentWords.find(w => w.word === wordText);
        const isMatch = word && word.definition === this.selectedDefinition.textContent;

        if (isMatch) {
            this.isProcessingMatch = true;
            this.handleCorrectMatch();
            // 更新单词出现次数
            const appearances = this.wordAppearances.get(wordText) || 0;
            this.wordAppearances.set(wordText, appearances + 1);
            
            // 淡出匹配的卡片
            this.selectedWord.classList.add('fading');
            this.selectedDefinition.classList.add('fading');
            this.selectedWord.style.opacity = '0';
            this.selectedDefinition.style.opacity = '0';
            
            // 暂时禁用所有卡片的点击事件
            this.disableCardClicks();
            
            // 保存匹配的卡片引用
            const matchedWord = this.selectedWord;
            const matchedDefinition = this.selectedDefinition;
            
            // 清除之前的超时处理器
            if (this.processingTimeout) {
                clearTimeout(this.processingTimeout);
            }
            
            // 设置新的超时处理器
            this.processingTimeout = setTimeout(() => {
                // 先从当前显示的单词中移除匹配的单词
                this.currentWords = this.currentWords.filter(w => w.word !== wordText);
                
                // 移除匹配的卡片
                matchedWord.remove();
                matchedDefinition.remove();
                this.selectedWord = null;
                this.selectedDefinition = null;
                
                // 检查是否需要补充单词池
                this.replenishWordPool();
                
                // 如果还有单词可以添加
                if (this.words.length > 0) {
                    // 添加新单词
                    const newWord = this.words.shift();
                    this.currentWords.push(newWord);
                    
                    // 找到空缺的位置
                    let position = 1;
                    const existingPositions = new Set();
                    Array.from(this.wordsArea.children).forEach(card => {
                        for (let i = 1; i <= this.displayCount; i++) {
                            if (card.classList.contains(`position-${i}`)) {
                                existingPositions.add(i);
                            }
                        }
                    });
                    
                    while (existingPositions.has(position)) {
                        position++;
                    }
                    
                    // 创建并添加新的单词卡片
                    const wordElement = this.createCard(newWord.word, 'word');
                    wordElement.classList.add(`position-${position}`);
                    wordElement.style.opacity = '0';
                    this.wordsArea.appendChild(wordElement);
                    
                    // 淡入新单词
                    setTimeout(() => {
                        wordElement.style.transition = 'opacity 0.5s';
                        wordElement.style.opacity = '1';
                    }, 50);
                    
                    // 更新释义区域
                    this.updateDefinitions();
                }
                
                // 重新启用卡片点击事件
                this.enableCardClicks();
                this.isProcessingMatch = false;
            }, 1000);
        } else {
            this.handleIncorrectMatch();
            // 错误匹配时自动收藏单词
            if (!this.isWordFavorited(wordText)) {
                this.toggleFavorite(wordText);
            }
            this.resetSelection();
        }
    }

    handleCorrectMatch() {
        this.selectedWord.classList.add('success');
        this.selectedDefinition.classList.add('success');
        this.score += 10;
        this.updateScore();
    }

    handleIncorrectMatch() {
        this.selectedWord.classList.add('error');
        this.selectedDefinition.classList.add('error');
        this.score = Math.max(0, this.score - 5);
        this.updateScore();
    }

    resetSelection() {
        if (this.selectedWord) {
            this.selectedWord.classList.remove('selected', 'success', 'error');
            this.selectedWord = null;
        }
        if (this.selectedDefinition) {
            this.selectedDefinition.classList.remove('selected', 'success', 'error');
            this.selectedDefinition = null;
        }
    }

    updateScore() {
        this.scoreElement.textContent = this.score;
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        this.pauseBtn.textContent = this.isPaused ? '继续' : '暂停';
        this.gameContainer.style.opacity = this.isPaused ? '0.5' : '1';
    }

    endGame() {
        // 检查是否所有单词都至少出现了5次
        const allWordsComplete = Array.from(this.wordAppearances.values())
            .every(count => count >= 5);
        
        if (allWordsComplete) {
            alert(`游戏结束！\n最终得分：${this.score}`);
            this.gameContainer.classList.add('hidden');
            this.wordListManager.classList.remove('hidden');
        }
    }

    replenishWordPool() {
        // 如果单词池为空，检查是否需要补充
        if (this.words.length === 0) {
            const needsReplenish = Array.from(this.wordAppearances.entries())
                .some(([_, count]) => count < 5);

            if (needsReplenish) {
                // 找出出现次数少于5次的单词
                const wordsToAdd = window.wordList.words.filter(word => 
                    this.wordAppearances.get(word.word) < 5
                );
                
                // 将这些单词添加到单词池中
                this.words = this.shuffleArray([...wordsToAdd]);
            }
        }
    }

    isWordFavorited(word) {
        return this.favorites.some(item => item.word === word);
    }

    toggleFavorite(word) {
        const index = this.favorites.findIndex(item => item.word === word);
        if (index === -1) {
            // 添加到收藏
            // 从当前显示的单词中查找释义
            const meaning = this.currentWords.find(w => w.word === word)?.definition ||
                          // 如果当前显示中没有，则从所有单词中查找
                          window.wordList.words.find(w => w.word === word)?.definition;
            this.favorites.push({ word, meaning });
        } else {
            // 从收藏中移除
            this.favorites.splice(index, 1);
        }
        // 保存到localStorage
        localStorage.setItem('favorites', JSON.stringify(this.favorites));
        // 更新UI
        this.updateFavoriteButtons();
        this.renderFavoriteList();
    }

    updateFavoriteButtons() {
        const wordCards = this.wordsArea.querySelectorAll('.word-card');
        wordCards.forEach(card => {
            const word = card.childNodes[0].textContent.trim();
            const btn = card.querySelector('.favorite-btn');
            if (btn) {
                btn.className = 'favorite-btn' + 
                    (this.isWordFavorited(word) ? ' active' : '');
            }
        });
    }

    toggleFavoriteList() {
        this.favoriteList.classList.toggle('hidden');
        this.toggleFavoriteBtn.textContent = 
            this.favoriteList.classList.contains('hidden') ? 
            '显示收藏' : '隐藏收藏';
        this.renderFavoriteList();
    }

    renderFavoriteList() {
        if (this.favoriteList.classList.contains('hidden')) return;

        const content = this.favoriteList.querySelector('.favorite-content');
        content.innerHTML = '';

        this.favorites.forEach(({ word, meaning }) => {
            const item = document.createElement('div');
            item.className = 'favorite-item';
            item.innerHTML = `
                <div class="word-info">
                    <div class="word">
                        ${word}
                        <button class="speak-btn" title="播放发音">🔊</button>
                    </div>
                    <div class="meaning">${meaning}</div>
                </div>
                <button class="remove-btn">删除</button>
            `;

            // 添加发音功能
            item.querySelector('.speak-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.speakWord(word);
            });

            item.querySelector('.remove-btn').addEventListener('click', () => {
                this.toggleFavorite(word);
            });

            content.appendChild(item);
        });
    }

    speakWord(word) {
        try {
            // 取消之前的语音
            window.speechSynthesis.cancel();
            // 创建语音合成对象
            const speech = new SpeechSynthesisUtterance(word);
            // 设置语言为英语
            speech.lang = 'en-US';
            // 设置语速
            speech.rate = 0.8;
            // 播放语音
            window.speechSynthesis.speak(speech);
        } catch (error) {
            console.error('语音播放失败:', error);
        }
    }

    updateDefinitions() {
        // 清空释义区域
        this.definitionsArea.innerHTML = '';
        
        // 获取当前所有单词的释义并打乱顺序
        const shuffledDefinitions = this.shuffleArray([...this.currentWords]);
        
        // 创建所有可能的位置组合
        let allPositions = this.generateAllPositionCombinations();
        
        // 从所有可能的位置组合中随机选择一个
        const positions = this.selectRandomPositions(allPositions, shuffledDefinitions.length);
        
        // 添加所有释义
        shuffledDefinitions.forEach((word, index) => {
            const definitionElement = this.createCard(word.definition, 'definition');
            definitionElement.classList.add(`position-${positions[index]}`);
            definitionElement.style.opacity = '0';
            this.definitionsArea.appendChild(definitionElement);
            
            // 使用随机延迟让动画更自然
            const delay = Math.random() * 200 + 50;
            setTimeout(() => {
                definitionElement.style.transition = 'opacity 0.5s';
                definitionElement.style.opacity = '1';
            }, delay);
        });
    }

    generateAllPositionCombinations() {
        const positions = [1, 2, 3, 4, 5];
        let combinations = [];
        
        // 生成所有可能的位置组合
        for (let i = 0; i < positions.length; i++) {
            for (let j = 0; j < positions.length; j++) {
                if (i !== j) {
                    combinations.push([...positions]);
                    this.shuffleArray(combinations[combinations.length - 1]);
                }
            }
        }
        
        return combinations;
    }
    
    selectRandomPositions(combinations, count) {
        // 从所有组合中随机选择一个
        const selectedCombination = combinations[Math.floor(Math.random() * combinations.length)];
        // 只返回需要的数量
        return selectedCombination.slice(0, count);
    }

    disableCardClicks() {
        const cards = [...this.wordsArea.children, ...this.definitionsArea.children];
        cards.forEach(card => {
            if (!card.classList.contains('fading')) {
                card.style.pointerEvents = 'none';
            }
        });
    }

    enableCardClicks() {
        const cards = [...this.wordsArea.children, ...this.definitionsArea.children];
        cards.forEach(card => {
            card.style.pointerEvents = 'auto';
        });
    }

    // 添加清理方法
    cleanup() {
        // 清除超时处理器
        if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
        }
        // 取消正在播放的语音
        window.speechSynthesis.cancel();
    }
}

const game = new WordGame(); 