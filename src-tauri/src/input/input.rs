use enigo::{
    Direction::{Click, Press, Release},
    Enigo, Key, Keyboard, Settings,
};
use std::thread;
use std::time::Duration;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use rand::Rng;
use super::syntax_tree::{Node, NodeContent, Parser};

static ENIGO: Lazy<Mutex<Enigo>> = Lazy::new(|| {
    Mutex::new(Enigo::new(&Settings::default()).unwrap())
});

/// 输入状态结构体，管理输入过程中的各种状态
struct TypeState {
    is_typing: bool,                // 是否正在输入
    next_type_position: usize,      // 下一个应该输入位置的下标 
    original_text: String,          // type_text传入的原始text内容
    type_sequence: String,          // 经过generate_type_sequence获取到的输入操作序列
}

static TYPE_STATE: Lazy<Mutex<TypeState>> = Lazy::new(|| {
    Mutex::new(TypeState {
        is_typing: false,
        next_type_position: 0,
        original_text: String::new(),
        type_sequence: String::new(),
    })
});

// 特殊按键的ASCII控制字符映射
const KEY_LEFT: char = '\u{0001}';      // SOH
const KEY_RIGHT: char = '\u{0002}';     // STX
const KEY_UP: char = '\u{0003}';        // ETX
const KEY_DOWN: char = '\u{0004}';      // EOT
const KEY_HOME: char = '\u{0005}';      // ENQ
const KEY_END: char = '\u{0006}';       // ACK
const KEY_SHIFT_P: char = '\u{0010}';   // DLE
const KEY_SHIFT_R: char = '\u{0011}';   // DC1
const KEY_BACKSPACE: char = '\u{0008}'; // BS

/// 返回当前平台的修饰键（macOS用Meta，其他平台用Control）
pub fn get_platform_modifier_key() -> Key {
    #[cfg(target_os = "macos")]
    {
        Key::Meta
    }

    #[cfg(not(target_os = "macos"))]
    {
        Key::Control
    }
}

/// 模拟按下Ctrl+V/Cmd+V粘贴剪贴板内容
pub fn paste_text() {
    thread::sleep(Duration::from_secs(1));
    let mut enigo = ENIGO.lock().unwrap();
    let modifier_key = get_platform_modifier_key();

    enigo.key(modifier_key, Press).unwrap();
    enigo.key(Key::Unicode('v'), Click).unwrap();
    enigo.key(modifier_key, Release).unwrap();
}

/// 模拟键盘输入文本
/// 首次调用开始输入，再次调用暂停
/// 如果在暂停状态下调用且文本相同，则继续输入
/// 如果文本不同，则重置输入状态
pub fn type_text(text: &str) {
    let mut state = TYPE_STATE.lock().unwrap();
    
    // 1. 取反is_typing
    state.is_typing = !state.is_typing;
    
    // 2. 检查text和original_text是否不一致
    if state.original_text != text {
        state.next_type_position = 0;
        state.original_text = text.to_string();
        
        // 重新生成输入序列
        match text_to_type_sequence(text) {
            Ok(sequence) => {
                state.type_sequence = sequence;
            },
            Err(error) => {
                eprintln!("无法解析输入文本: {}", error);
                state.type_sequence = String::new();
                state.is_typing = false;
            }
        }
    }
    
    // 如果序列为空，无需启动线程
    if state.type_sequence.is_empty() {
        state.is_typing = false;
        return;
    }
    
    // 3. 根据is_typing判断是否启动工作线程
    if state.is_typing {
        // 保存状态，用于线程中使用
        let next_position = state.next_type_position;
        let sequence = state.type_sequence.clone();
        
        // 释放锁
        drop(state);
        
        // 启动工作线程
        thread::spawn(move || {
            thread::sleep(Duration::from_secs(1));
            
            // 获取剩余需要输入的字符序列
            if next_position < sequence.len() {
                let remaining_seq = &sequence[next_position..];
                let mut enigo = ENIGO.lock().unwrap();
                let mut prev_char = None;
                
                let mut current_position = next_position;
                for c in remaining_seq.chars() {
                    // 检查是否应该停止输入
                    {
                        let state = TYPE_STATE.lock().unwrap();
                        if !state.is_typing {
                            // 更新next_type_position后退出
                            drop(state);
                            let mut state = TYPE_STATE.lock().unwrap();
                            state.next_type_position = current_position;
                            return;
                        }
                    }
                    
                    // 处理当前字符
                    process_type_char(&mut enigo, prev_char, c);
                    prev_char = Some(c);
                    current_position += 1;
                }
                
                // 输入完成后重置状态
                let mut state = TYPE_STATE.lock().unwrap();
                state.is_typing = false;
                state.next_type_position = 0;
            }
        });
    }
}

/// 从文本生成输入序列
fn text_to_type_sequence(text: &str) -> Result<String, String> {
    let parser = Parser::new();
    let root = parser.parse(text)?;
    
    Ok(node_to_type_sequence(root))
}

/// 生成节点的输入序列
fn node_to_type_sequence(node: Node) -> String {
    let mut type_seq = String::new();
    
    if node.bracket_type != "root" {
        type_seq.push_str(&node.bracket_type);
        type_seq.push(KEY_LEFT);
        
        if !node.is_single_line {
            type_seq.push_str("\n\n");
            type_seq.push(KEY_UP);
        }
    }
    
    for content in node.contents {
        match content {
            NodeContent::Text(text) => {
                type_seq.push_str(&text);
            }
            NodeContent::Child(child) => {
                // 递归获取子节点的序列并附加到当前序列
                type_seq.push_str(&node_to_type_sequence(*child));
            }
        }
    }
    
    type_seq.push(KEY_RIGHT);
    if !node.is_single_line {
        type_seq.push(KEY_RIGHT);
        type_seq.push(KEY_END);
    }
    
    type_seq
}

/// 处理单个输入字符
fn process_type_char(enigo: &mut Enigo, prev_char: Option<char>, current_char: char) {
    // 只处理ASCII字符
    if !current_char.is_ascii() {
        return;
    }
    
    let mut rng = rand::rng();
    
    // 根据字符类型决定延迟时间
    let delay = match (current_char, prev_char) {
        (c, Some(prev)) if prev == c => rng.random_range(5..=10),
        (' ', _) => 10,
        ('\n', _) => rng.random_range(200..=2000),
        (c, _) => match c {
            '\n' => rng.random_range(50..=200),
            c if c.is_lowercase() => rng.random_range(50..=90),
            c if c.is_uppercase() => rng.random_range(70..=110),
            _ => rng.random_range(200..=400)
        }
    };

    thread::sleep(Duration::from_millis(delay));
    
    // 根据字符类型执行相应的键盘操作
    match current_char {
        '\n' => perform_crlf(enigo),
        KEY_LEFT => enigo.key(Key::LeftArrow, Click).unwrap(),
        KEY_RIGHT => enigo.key(Key::RightArrow, Click).unwrap(),
        KEY_UP => enigo.key(Key::UpArrow, Click).unwrap(),
        KEY_DOWN => enigo.key(Key::DownArrow, Click).unwrap(),
        KEY_HOME => enigo.key(Key::Home, Click).unwrap(),
        KEY_END => enigo.key(Key::End, Click).unwrap(),
        KEY_SHIFT_P => enigo.key(Key::Shift, Press).unwrap(),
        KEY_SHIFT_R => enigo.key(Key::Shift, Release).unwrap(),
        KEY_BACKSPACE => enigo.key(Key::Backspace, Click).unwrap(),
        _ => enigo.text(&current_char.to_string()).unwrap(),
    }
}

/// 处理回车换行，生成正确的缩进
fn perform_crlf(enigo: &mut Enigo) {
    enigo.key(Key::Return, Click).unwrap();
    enigo.key(Key::Space, Click).unwrap();
    enigo.key(Key::Shift, Press).unwrap();
    enigo.key(Key::Home, Click).unwrap();
    enigo.key(Key::Shift, Release).unwrap();
    enigo.key(Key::Backspace, Click).unwrap();
}
