from docx import Document
import re

def clean_chinese(text):
    """清理中文释义，提取主要含义"""
    # 删除词性标注和特殊符号，但保留分号和逗号之间的内容
    text = re.sub(r'[a-zA-Z]+\.', '', text)
    # 删除括号内容
    text = re.sub(r'[（(].*?[)）]', '', text)
    # 删除特殊标点，但保留中文标点
    text = re.sub(r'[・•]', '', text)
    # 删除多余的空格
    text = re.sub(r'\s+', ' ', text)
    # 删除开头的标点
    text = re.sub(r'^[,，;；\s]+', '', text)
    # 删除结尾的标点和省略号
    text = re.sub(r'[,，;；\s…]+$', '', text)
    return text.strip()

def is_english_word(text):
    """检查是否为英文单词或词组"""
    # 允许包含空格、连字符和撇号的英文单词或词组
    text = text.strip()
    return bool(re.match(r'^[a-zA-Z\s\'-]+$', text) and not text.isspace())

def extract_word_pairs(table):
    """从表格中提取单词对"""
    word_pairs = []
    
    # 遍历表格的每一行
    for row in table.rows:
        cells = row.cells
        if len(cells) < 3:  # 跳过格式不正确的行
            continue
            
        # 跳过表头行
        if any(header in cells[0].text.lower() for header in ['no', 'no.', 'word', 'meaning']):
            continue
            
        # 处理左侧单词对
        if len(cells) >= 3:
            word = cells[1].text.strip()
            if is_english_word(word):
                meaning = clean_chinese(cells[2].text.strip())
                if word and meaning:
                    word_pairs.append((word, meaning))
        
        # 处理右侧单词对
        if len(cells) >= 6:
            word = cells[4].text.strip()
            if is_english_word(word):
                meaning = clean_chinese(cells[5].text.strip())
                if word and meaning:
                    word_pairs.append((word, meaning))
    
    return word_pairs

def convert_word_to_wordlist(word_file_path, output_file_path):
    try:
        # 读取Word文档
        doc = Document(word_file_path)
        all_word_pairs = []
        
        # 遍历文档中的所有表格
        for table in doc.tables:
            word_pairs = extract_word_pairs(table)
            all_word_pairs.extend(word_pairs)
        
        # 去重（如果需要）
        unique_pairs = list(dict.fromkeys(all_word_pairs))
        
        # 将结果写入文件
        with open(output_file_path, 'w', encoding='utf-8') as f:
            for word, meaning in unique_pairs:
                f.write(f"{word},{meaning}\n")
            
        print(f"转换完成！已生成文件：{output_file_path}")
        print(f"共转换 {len(unique_pairs)} 个单词对")
        
    except Exception as e:
        print(f"转换过程中出现错误：{str(e)}")
        raise e

if __name__ == "__main__":
    word_file = "vocabulary.docx"  # 您的Word文件名
    output_file = "wordlist.txt"
    convert_word_to_wordlist(word_file, output_file) 