/// 表示语法树节点的内容：文本或子节点
#[derive(Debug)]
pub enum NodeContent {
    Text(String),
    Child(Box<Node>),
}

/// 语法树中的节点，代表一对符号及其内容
#[derive(Debug)]
pub struct Node {
    // 节点的括号类型 (如 "()", "[]", "{}")
    pub bracket_type: String,
    pub is_single_line: bool,
    pub contents: Vec<NodeContent>,
    pub start_line: usize,
    pub end_line: usize,
}

impl Node {
    /// 创建新节点
    fn new(bracket_type: &str, start_line: usize) -> Self {
        Node {
            bracket_type: bracket_type.to_string(),
            is_single_line: true,
            contents: Vec::new(),
            start_line,
            end_line: start_line,
        }
    }

    /// 添加非空文本到节点
    fn add_text(&mut self, text: String) {
        if !text.is_empty() {
            self.contents.push(NodeContent::Text(text));
        }
    }

    /// 添加子节点
    fn add_child(&mut self, child: Node) {
        self.contents.push(NodeContent::Child(Box::new(child)));
    }

    /// 过滤规则
    fn filters(&mut self) {
        // 如果没有内容，则不需要过滤
        if self.contents.is_empty() {
            return;
        }

        // 对所有子节点递归应用过滤
        for content in &mut self.contents {
            if let NodeContent::Child(child) = content {
                child.filters();
            }
        }

        // 过滤1: 如果第一个子节点是文本节点且以\n开头，则移除该\n
        if let Some(NodeContent::Text(text)) = self.contents.first_mut() {
            if text.starts_with('\n') {
                // 移除第一个字符 \n
                *text = text[1..].to_string();
                
                // 如果移除后字符串为空，则删除这个节点
                if text.is_empty() {
                    self.contents.remove(0);
                }
            }
        }

        // 过滤2: 如果最后一个子节点是文本节点且以\n+空格结尾，则移除这部分
        if let Some(NodeContent::Text(text)) = self.contents.last_mut() {
            if let Some(pos) = text.rfind('\n') {
                let tail = &text[pos+1..];
                if tail.chars().all(|c| c.is_whitespace()) {
                    *text = text[..pos].to_string();
                }
            }
        }
    }
}

/// 代码解析器，用于构建括号语法树
pub struct Parser {}

impl Parser {
    /// 创建新解析器
    pub fn new() -> Self {
        Parser {}
    }

    /// 检查字符是否为开括号
    fn is_opening_bracket(&self, c: char) -> bool {
        matches!(c, '(' | '[' | '{')
    }

    /// 获取开括号对应的闭括号
    fn get_closing_bracket(&self, c: char) -> Option<char> {
        match c {
            '(' => Some(')'),
            '[' => Some(']'),
            '{' => Some('}'),
            _ => None,
        }
    }

    /// 获取括号对的类型表示，如 "()"
    fn bracket_type(&self, open: char) -> String {
        if let Some(close) = self.get_closing_bracket(open) {
            format!("{}{}", open, close)
        } else {
            String::new()
        }
    }

    /// 解析文本，构建语法树
    pub fn parse(&self, text: &str) -> Result<Node, String> {
        let mut root = Node::new("root", 1);
        let (_, last_line) = self.parse_content(text, &mut root, 1)?;
        root.end_line = last_line;
        root.filters();
        Ok(root)
    }

    /// 递归解析节点内容
    fn parse_content(
        &self,
        text: &str,
        parent: &mut Node,
        start_line: usize,
    ) -> Result<(usize, usize), String> {
        let chars: Vec<char> = text.chars().collect();
        let mut current_pos = 0;
        let mut current_line = start_line;
        let mut current_text = String::new();

        // 状态跟踪
        let mut in_string = None; // None, Some('"'), or Some('\'')
        let mut escaped = false; // 前一个字符是否为转义符

        while current_pos < chars.len() {
            let c = chars[current_pos];

            // 更新行计数
            if c == '\n' {
                current_line += 1;
                parent.is_single_line = false;
            }

            // 使用 match 替代嵌套的条件逻辑
            match (c, escaped, in_string) {
                // 处理转义字符
                (_, true, _) => {
                    current_text.push(c);
                    escaped = false;
                    current_pos += 1;
                    continue;
                }
                // 开始转义序列
                ('\\', false, Some(_)) => {
                    current_text.push(c);
                    escaped = true;
                    current_pos += 1;
                    continue;
                }
                // 字符串结束
                (c, false, Some(quote)) if c == quote => {
                    current_text.push(c);
                    in_string = None;
                    current_pos += 1;
                    continue;
                }
                // 字符串内容
                (_, false, Some(_)) => {
                    current_text.push(c);
                    current_pos += 1;
                    continue;
                }
                // 进入字符串
                ('\'' | '"', false, None) => {
                    in_string = Some(c);
                    current_text.push(c);
                    current_pos += 1;
                    continue;
                }
                // 开括号 - 创建新节点
                (c, false, None) if self.is_opening_bracket(c) => {
                    // 保存当前文本
                    if !current_text.is_empty() {
                        parent.add_text(current_text);
                        current_text = String::new();
                    }

                    // 创建子节点，使用bracket_type方法获取括号类型
                    let bracket_type = self.bracket_type(c);
                    let mut child = Node::new(&bracket_type, current_line);

                    // 跳过开括号
                    current_pos += 1;

                    // 递归解析子节点内容
                    if current_pos < chars.len() {
                        // 从当前位置到结尾的字符集合
                        let remaining_text = chars[current_pos..].iter().collect::<String>();

                        let (consumed_chars, new_line) =
                            self.parse_content(&remaining_text, &mut child, current_line)?;

                        // 更新位置和行
                        current_pos += consumed_chars + 1; // +1 为闭括号
                        current_line = new_line;

                        // 更新子节点信息
                        child.end_line = current_line;
                        child.is_single_line = child.start_line == child.end_line;

                        // 添加到父节点
                        parent.add_child(child);
                    } else {
                        return Err(format!("未闭合的括号: '{}'", bracket_type));
                    }

                    continue;
                }
                // 检查闭括号 - 结束当前节点
                (c, false, None) if parent.bracket_type != "root" => {
                    let expected_close = parent.bracket_type.chars().nth(1).unwrap();
                    if c == expected_close {
                        // 保存剩余文本
                        if !current_text.is_empty() {
                            parent.add_text(current_text);
                        }

                        return Ok((current_pos, current_line));
                    }

                    // 常规字符，添加到当前文本
                    current_text.push(c);
                    current_pos += 1;
                }
                // 默认情况 - 常规字符
                _ => {
                    current_text.push(c);
                    current_pos += 1;
                }
            }
        }

        // 处理剩余文本
        if !current_text.is_empty() {
            parent.add_text(current_text);
        }

        // 检查未闭合的括号
        if parent.bracket_type != "root" {
            return Err(format!("未闭合的括号: '{}'", parent.bracket_type));
        }

        Ok((current_pos, current_line))
    }
}
