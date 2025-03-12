class Database {
    constructor() {
        this.dbVersion = 2;  // 增加数据库版本号
        this.initDatabase();
    }

    async initDatabase() {
        // 使用 IndexedDB 作为浏览器端数据库
        const request = indexedDB.open('wordGameDB', this.dbVersion);

        request.onerror = (event) => {
            console.error('数据库错误:', event.target.error);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            console.log('Upgrading database...');

            // 如果存在旧的对象存储，先删除
            if (db.objectStoreNames.contains('words')) {
                db.deleteObjectStore('words');
            }
            if (db.objectStoreNames.contains('wordLists')) {
                db.deleteObjectStore('wordLists');
            }
            if (db.objectStoreNames.contains('favorites')) {
                db.deleteObjectStore('favorites');
            }

            // 创建单词表列表
            const listStore = db.createObjectStore('wordLists', { keyPath: 'id', autoIncrement: true });
            listStore.createIndex('title', 'title', { unique: true });

            // 创建单词表
            const wordStore = db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
            wordStore.createIndex('word', 'word', { unique: false });  // 允许重复单词
            wordStore.createIndex('listId', 'listId');  // 添加listId索引

            // 创建收藏表
            const favoriteStore = db.createObjectStore('favorites', { keyPath: 'id', autoIncrement: true });
            favoriteStore.createIndex('wordId', 'wordId');

            console.log('Database upgrade completed');
        };

        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('Database initialized successfully');
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async addWord(word, definition) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readwrite');
            const store = transaction.objectStore('words');

            const request = store.add({ word, definition });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllWords() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readonly');
            const store = transaction.objectStore('words');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async importWords(wordList) {
        const transaction = this.db.transaction(['words'], 'readwrite');
        const store = transaction.objectStore('words');
        const index = store.index('word');

        return Promise.all(wordList.map(({ word, definition }) => {
            return new Promise((resolve, reject) => {
                // 先查找是否存在该单词
                const getRequest = index.getKey(word);
                getRequest.onsuccess = () => {
                    if (getRequest.result) {
                        // 如果存在，则更新
                        const updateRequest = store.put({
                            id: getRequest.result,
                            word,
                            definition
                        });
                        updateRequest.onsuccess = () => resolve();
                        updateRequest.onerror = () => reject(updateRequest.error);
                    } else {
                        // 如果不存在，则添加
                        const addRequest = store.add({ word, definition });
                        addRequest.onsuccess = () => resolve();
                        addRequest.onerror = () => reject(addRequest.error);
                    }
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        }));
    }

    async clearWords() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readwrite');
            const store = transaction.objectStore('words');
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async deleteWord(word) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readwrite');
            const store = transaction.objectStore('words');
            const index = store.index('word');
            
            const request = index.getKey(word);
            request.onsuccess = () => {
                if (request.result) {
                    const deleteRequest = store.delete(request.result);
                    deleteRequest.onsuccess = () => resolve();
                    deleteRequest.onerror = () => reject(deleteRequest.error);
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async createWordList(title) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['wordLists'], 'readwrite');
            const store = transaction.objectStore('wordLists');
            const request = store.add({ 
                title,
                createdAt: new Date()
            });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getWordLists() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['wordLists'], 'readonly');
            const store = transaction.objectStore('wordLists');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getWordsByListId(listId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['words'], 'readonly');
            const store = transaction.objectStore('words');
            const index = store.index('listId');
            const request = index.getAll(listId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async importWordsToList(listId, wordList) {
        if (!listId) {
            throw new Error('Invalid listId');
        }
        
        if (!Array.isArray(wordList) || wordList.length === 0) {
            throw new Error('Invalid word list');
        }
        
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        
        if (!this.db.objectStoreNames.contains('words')) {
            throw new Error('Words store not found');
        }
        
        const transaction = this.db.transaction(['words'], 'readwrite');
        const store = transaction.objectStore('words');
        
        return Promise.all(wordList.map(({ word, definition }) => {
            if (!word || !definition) {
                throw new Error('Invalid word or definition');
            }
            return new Promise((resolve, reject) => {
                const request = store.add({ 
                    word, 
                    definition,
                    listId: parseInt(listId)
                });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }));
    }

    async deleteWordList(listId) {
        if (!listId) {
            throw new Error('Invalid listId');
        }

        return new Promise(async (resolve, reject) => {
            try {
                const tx = this.db.transaction(['words', 'wordLists'], 'readwrite');
                const wordStore = tx.objectStore('words');
                const listStore = tx.objectStore('wordLists');
                const wordIndex = wordStore.index('listId');

                // 删除该单词表中的所有单词
                const wordsRequest = wordIndex.getAllKeys(parseInt(listId));
                wordsRequest.onsuccess = async () => {
                    const wordKeys = wordsRequest.result;
                    // 删除每个单词
                    for (const key of wordKeys) {
                        await new Promise((res, rej) => {
                            const delRequest = wordStore.delete(key);
                            delRequest.onsuccess = () => res();
                            delRequest.onerror = () => rej(delRequest.error);
                        });
                    }

                    // 删除单词表本身
                    const listRequest = listStore.delete(parseInt(listId));
                    listRequest.onsuccess = () => resolve();
                    listRequest.onerror = () => reject(listRequest.error);
                };
                wordsRequest.onerror = () => reject(wordsRequest.error);
            } catch (error) {
                reject(error);
            }
        });
    }
}

// 创建全局数据库实例
window.db = new Database(); 