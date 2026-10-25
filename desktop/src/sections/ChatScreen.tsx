import React, { useState, useEffect } from "react";
import {
  Brain,
  Search,
  FileSpreadsheet,
  Calendar,
  BarChart3,
  Paperclip,
  ArrowRight,
  ChevronRight,
  Sparkles,
  BookOpen,
  FileText,
  Clock,
} from "lucide-react";
import { QAResult } from "../types/api";

interface ChatScreenProps {
  initialPrompt?: string;
  promptSignal?: number;
  onOpenSource?: (path: string) => void;
  onAsk: (question: string) => Promise<QAResult>;
}

interface MessageItem {
  id: string;
  sender: "user" | "assistant";
  text: string;
  sources?: any[];
  timestamp: string;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  onAsk,
  initialPrompt = "",
  promptSignal,
  onOpenSource,
}) => {
  const [inputVal, setInputVal] = useState(initialPrompt);
  useEffect(() => {
    setInputVal(initialPrompt);
  }, [initialPrompt, promptSignal]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(false);

  const quickCards = [
    {
      id: "card-info",
      title: "Найти информацию",
      desc: "Поиск по вашей рабочей памяти",
      icon: <Search size={18} />,
      colorClass: "blue",
      prompt: "На чём я остановился и что обсуждалось в последних документах?",
    },
    {
      id: "card-table",
      title: "Проанализировать таблицу",
      desc: "Найду инсайты и сделаю выводы",
      icon: <FileSpreadsheet size={18} />,
      colorClass: "green",
      prompt: "Откуда взялась эта цифра в смете и какие были расчеты?",
    },
    {
      id: "card-meeting",
      title: "Подготовить к встрече",
      desc: "Соберу материалы и краткое резюме",
      icon: <Calendar size={18} />,
      colorClass: "purple",
      prompt: "Подготовь материалы и краткое резюме к ближайшей встрече",
    },
    {
      id: "card-report",
      title: "Создать отчет",
      desc: "Из ваших файлов и данных",
      icon: <BarChart3 size={18} />,
      colorClass: "violet",
      prompt: "Составь сводку выполненных за сегодня дел и текущий статус",
    },
  ];

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputVal).trim();
    if (!text || loading) return;

    const userMsg: MessageItem = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString().slice(0, 5),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setLoading(true);

    try {
      const res = await onAsk(text);
      const aiMsg: MessageItem = {
        id: `ai-${Date.now()}`,
        sender: "assistant",
        text: res.answer,
        sources: res.sources,
        timestamp: new Date().toLocaleTimeString().slice(0, 5),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e: any) {
      setInputVal(text);
      const errMsg: MessageItem = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: `Ошибка при обработке запроса: ${e.message || e}`,
        timestamp: new Date().toLocaleTimeString().slice(0, 5),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-screen-container">
      {/* If no messages yet, show hero & 4 prompt cards from screenshot */}
      {messages.length === 0 ? (
        <div className="chat-hero-section">
          <div className="chat-hero-brain-icon">
            <Brain size={56} strokeWidth={1.75} />
          </div>

          <h2 className="chat-hero-heading">Чем я могу помочь, Андрей? 👋</h2>
          <p className="chat-hero-sub">
            Я помню, над чем вы работали, и помогу найти нужную информацию,
            продолжить задачи и подготовиться к встречам.
          </p>

          {/* 4 Cards Grid */}
          <div className="quick-prompt-cards">
            {quickCards.map((card) => (
              <div
                key={card.id}
                className="quick-card"
                onClick={() => handleSend(card.prompt)}
              >
                <div className="quick-card-left">
                  <div className={`quick-card-icon ${card.colorClass}`}>
                    {card.icon}
                  </div>
                  <div>
                    <div className="quick-card-title">{card.title}</div>
                    <div className="quick-card-desc">{card.desc}</div>
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-light)" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Messages Flow */
        <div className="chat-messages-flow">
          {messages.map((m) =>
            m.sender === "user" ? (
              <div key={m.id} className="chat-bubble-user">
                <div>{m.text}</div>
                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.8,
                    textAlign: "right",
                    marginTop: 4,
                  }}
                >
                  {m.timestamp}
                </div>
              </div>
            ) : (
              <div key={m.id} className="chat-bubble-ai">
                <div className="chat-ai-header">
                  <Sparkles size={16} />
                  <span>Второй Мозг</span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-light)",
                      fontWeight: 400,
                      marginLeft: "auto",
                    }}
                  >
                    {m.timestamp}
                  </span>
                </div>
                <div className="chat-ai-body">{m.text}</div>

                {/* Sources list */}
                {m.sources && m.sources.length > 0 && (
                  <div className="sources-container">
                    <div className="sources-heading">
                      Подтверждающие источники ({m.sources.length}):
                    </div>
                    {m.sources.map((src: any, idx: number) => (
                      <div key={idx} className="source-item-card">
                        <div className="source-item-title">
                          [{idx + 1}] {src.title || src.relative_path}
                        </div>
                        {src.snippet && (
                          <div
                            style={{
                              color: "var(--text-secondary)",
                              marginTop: 2,
                            }}
                            children={src.snippet?.replace(/<\/?b>/g, "")}
                          />
                        )}
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            marginTop: 2,
                          }}
                        >
                          <button
                            onClick={() => onOpenSource?.(src.relative_path)}
                          >
                            Открыть {src.relative_path}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
          {loading && (
            <div
              className="chat-bubble-ai"
              style={{ color: "var(--text-muted)", fontStyle: "italic" }}
            >
              Ассистент анализирует рабочую память и готовит ответ с
              источниками...
            </div>
          )}
        </div>
      )}

      {/* Floating Bottom Prompt Bar */}
      <div className="chat-bottom-input-wrap">
        <div className="chat-input-pill-box">
          <button
            className="chat-clip-btn"
            disabled
            title="Импорт файлов появится в M3"
            aria-label="Импорт файлов пока недоступен"
          >
            <Paperclip size={18} />
          </button>
          <input
            type="text"
            className="chat-main-input"
            placeholder="Задайте вопрос или опишите задачу..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <span className="chat-shortcut-hint">⌘ + Enter</span>
          <button
            className="chat-send-btn"
            aria-label="Отправить вопрос"
            disabled={loading || !inputVal.trim()}
            onClick={() => handleSend()}
          >
            <ArrowRight size={17} />
          </button>
        </div>

        {/* Action chips below input from screenshot */}
        <div className="chat-chips-row">
          <button
            className="chat-chip"
            onClick={() => handleSend("Найти в файлах последние изменения")}
          >
            <FileText size={13} color="var(--primary)" />
            <span>Найти в файлах</span>
          </button>
          <button
            className="chat-chip"
            onClick={() =>
              handleSend("На чём я остановился? Продолжить задачу")
            }
          >
            <Clock size={13} color="var(--primary)" />
            <span>Продолжить задачу</span>
          </button>
          <button
            className="chat-chip"
            onClick={() => handleSend("Создать план на оставшуюся часть дня")}
          >
            <Sparkles size={13} color="var(--primary)" />
            <span>Создать план</span>
          </button>
        </div>
      </div>
    </div>
  );
};
