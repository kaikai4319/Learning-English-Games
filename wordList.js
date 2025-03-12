class WordList {
    constructor() {
        this.initializeElements();
        this.currentWords = [];  // 存储当前主页显示的单词
        // 等待数据库初始化完成
        window.db.initDatabase().then(() => {
            console.log('Database ready, initializing word list...');
            this.bindEvents();
            this.loadWordLists();
        }).catch(error => {
            console.error('Database initialization failed:', error);
            alert('数据库初始化失败，请刷新页面重试');
        });
    }

    initializeElements() {
        this.wordInput = document.getElementById('wordInput');
        this.definitionInput = document.getElementById('definitionInput');
        this.addWordBtn = document.getElementById('addWordBtn');
        this.saveListBtn = document.getElementById('saveListBtn');
        this.loadListBtn = document.getElementById('loadListBtn');
        this.wordListTable = document.getElementById('wordList').getElementsByTagName('tbody')[0];
        this.fileInput = document.getElementById('fileInput');
        this.importListBtn = document.getElementById('importListBtn');
        this.wordListSelect = document.createElement('select');
        this.wordListSelect.id = 'wordListSelect';
        this.wordListSelect.style.marginRight = '10px';
        this.loadListBtn.parentNode.insertBefore(this.wordListSelect, this.loadListBtn);
        
        // 添加批量删除按钮
        this.deleteListBtn = document.createElement('button');
        this.deleteListBtn.textContent = '删除当前单词表';
        this.deleteListBtn.style.marginLeft = '10px';
        this.loadListBtn.parentNode.appendChild(this.deleteListBtn);
    }

    async bindEvents() {
        this.addWordBtn.addEventListener('click', async () => await this.addWord());
        this.saveListBtn.addEventListener('click', async () => await this.saveList());
        this.loadListBtn.addEventListener('click', async () => await this.loadList());
        this.importListBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', async (e) => await this.handleFileImport(e));
        this.wordListSelect.addEventListener('change', async () => {
            const listId = parseInt(this.wordListSelect.value);
            if (listId) {
                await this.loadWordsFromList(listId);
            }
        });
        
        // 绑定批量删除事件
        this.deleteListBtn.addEventListener('click', async () => {
            await this.deleteCurrentList();
        });
    }

    async addWord() {
        const word = this.wordInput.value.trim();
        const definition = this.definitionInput.value.trim();

        if (!word || !definition) {
            alert('请输入单词和释义！');
            return;
        }

        try {
            await window.db.addWord(word, definition);
            await this.refreshWordList();
            this.clearInputs();
        } catch (error) {
            if (error.name === 'ConstraintError') {
                alert('该单词已存在！');
            } else {
                alert('添加单词失败！');
                console.error(error);
            }
        }
    }

    addWordToTable(wordObj) {
        const row = this.wordListTable.insertRow();
        const word = wordObj.word || wordObj.Word || '';
        const definition = wordObj.definition || wordObj.Meaning || '';
        row.innerHTML = `
            <td>${word}</td>
            <td>${definition}</td>
            <td>
                <button onclick="wordList.deleteWord('${word}')">删除</button>
            </td>
        `;
    }

    async deleteWord(word) {
        try {
            await window.db.deleteWord(word);
            await this.refreshWordList();
        } catch (error) {
            alert('删除单词失败！');
            console.error(error);
        }
    }

    refreshTable() {
        this.wordListTable.innerHTML = '';
        this.words.forEach(word => this.addWordToTable(word));
    }

    clearInputs() {
        this.wordInput.value = '';
        this.definitionInput.value = '';
    }

    async saveList() {
        // 检查主页是否有单词
        if (!this.currentWords || this.currentWords.length === 0) {
            alert('请先导入单词！');
            return;
        }
        
        const title = prompt('请为这个单词表起一个标题：');
        if (!title) return;
        
        try {
            // 确保单词格式正确
            const formattedWords = this.currentWords.map(word => ({
                word: word.word || word.Word,
                definition: word.definition || word.Meaning
            }));
            
            console.log('Saving words:', formattedWords); // 调试用
            
            // 保存当前主页显示的单词到数据库
            const listId = await window.db.createWordList(title);
            if (!listId) {
                throw new Error('Failed to create word list');
            }
            
            await window.db.importWordsToList(listId, formattedWords);
            await this.loadWordLists();
            alert('单词表保存成功！');
        } catch (error) {
            if (error.name === 'ConstraintError') {
                alert('该标题已存在！');
            } else {
                alert('保存失败！' + error.message);
                console.error('Save error:', error);
            }
        }
    }

    async loadList() {
        const listId = parseInt(this.wordListSelect.value);
        if (!listId) {
            alert('请选择要加载的单词表！');
            return;
        }
        
        try {
            // 从数据库加载单词并显示在主页
            const words = await window.db.getWordsByListId(listId);
            this.wordListTable.innerHTML = '';
            words.forEach(word => this.addWordToTable(word));
            // 确保保存的单词格式正确
            this.currentWords = words.map(word => ({
                word: word.word,
                definition: word.definition
            }));
            alert('单词表加载成功！');
        } catch (error) {
            alert('加载失败！');
            console.error(error);
        }
    }

    async refreshWordList() {
        const words = await window.db.getAllWords();
        this.wordListTable.innerHTML = '';
        words.forEach(word => this.addWordToTable(word));
    }

    async loadWordLists() {
        const lists = await window.db.getWordLists();
        this.wordListSelect.innerHTML = '<option value="">选择单词表...</option>';
        lists.forEach(list => {
            const option = document.createElement('option');
            option.value = list.id;
            option.textContent = list.title;
            this.wordListSelect.appendChild(option);
        });
    }

    async loadWordsFromList(listId) {
        const words = await window.db.getWordsByListId(listId);
        // 更新 currentWords
        this.currentWords = words.map(word => ({
            word: word.word,
            definition: word.definition
        }));
        this.wordListTable.innerHTML = '';
        this.currentWords.forEach(word => this.addWordToTable(word));
    }

    async handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target.result;
                const lines = content.split('\n');
                let importedWords = [];
                
                lines.forEach(line => {
                    if (!line.trim()) return;
                    // 修改分割逻辑以处理 Word,Meaning 格式
                    let [word, definition] = line.split(',').map(item => item.trim());
                    // 如果是标题行，跳过
                    if (word === 'Word' || word === 'word') return;
                    if (word && definition) {
                        importedWords.push({
                            word: word,
                            definition: definition
                        });
                    }
                });

                if (importedWords.length === 0) {
                    alert('没有找到有效的单词数据！');
                    return;
                }

                // 直接显示在主页上
                this.wordListTable.innerHTML = '';
                importedWords.forEach(word => this.addWordToTable(word));
                this.currentWords = importedWords;  // 保存当前导入的单词
                alert(`成功导入${importedWords.length}个单词！`);

            } catch (error) {
                alert('导入失败！请检查文件格式是否正确。');
                console.error(error);
            }
        };
        
        reader.readAsText(file);
        this.fileInput.value = '';
    }

    async deleteCurrentList() {
        // 检查是否有当前显示的单词表
        if (!this.currentWords || this.currentWords.length === 0) {
            alert('没有可删除的单词表！');
            return;
        }

        const selectedListId = parseInt(this.wordListSelect.value);
        if (!selectedListId) {
            alert('请先选择要删除的单词表！');
            return;
        }

        if (!confirm('确定要删除当前单词表吗？此操作不可恢复！')) {
            return;
        }

        try {
            // 删除数据库中的单词和单词表
            await window.db.deleteWordList(selectedListId);
            // 清空当前显示
            this.wordListTable.innerHTML = '';
            this.currentWords = [];
            // 重新加载单词表列表
            await this.loadWordLists();
            alert('单词表删除成功！');
        } catch (error) {
            alert('删除失败！');
            console.error('Delete error:', error);
        }
    }
}

// 创建全局 wordList 实例
window.wordList = new WordList(); 