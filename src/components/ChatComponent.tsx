/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { 
  MessageSquare, 
  Send, 
  ShieldCheck, 
  ShieldAlert, 
  Users, 
  MessageCircle, 
  Compass,
  CornerDownLeft
} from 'lucide-react';

export const ChatComponent: React.FC = () => {
  const { 
    messages, 
    currentCountry, 
    activeChatTab, 
    selectedPrivateRecipient, 
    setChatConfig, 
    sendChatMessage, 
    countries 
  } = useGame();

  const [messageInput, setMessageInput] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!currentCountry) return null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    try {
      await sendChatMessage(messageInput);
      setMessageInput('');
    } catch(err) {
      console.error(err);
    }
  };

  // Filter messages based on active channel
  const displayedMessages = messages.filter((m) => {
    if (activeChatTab === 'global') {
      return m.allianceId === null && m.recipientId === null;
    }
    if (activeChatTab === 'alliance') {
      return m.allianceId === currentCountry.allianceId;
    }
    if (activeChatTab === 'private') {
      // DMs involving current user
      return (
        m.recipientId === currentCountry.id || 
        (m.senderId === currentCountry.id && m.recipientId !== null)
      );
    }
    return false;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-2xl h-[550px]">
      
      {/* 1. Left Sidebar - Chat Folders Channels select */}
      <div className="md:col-span-3 bg-slate-950/40 border-l border-slate-850 p-4 flex flex-col justify-between">
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-slate-800">
            <MessageSquare className="w-4 h-4 text-amber-500" />
            منصات التواصل العام والخاص
          </h3>

          <div className="space-y-1">
            
            {/* Global Chat select */}
            <button
              onClick={() => setChatConfig('global', null)}
              className={`w-full flex items-center justify-between text-right p-2.5 rounded text-xs transition-all cursor-pointer ${activeChatTab === 'global' ? 'bg-amber-500 text-slate-950 font-black' : 'hover:bg-slate-900 text-slate-400'}`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>الدردشة العالمية العامة</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${activeChatTab === 'global' ? 'bg-slate-900/10 text-slate-950' : 'bg-slate-900 text-slate-400'}`}>العالم</span>
            </button>

            {/* Alliance Chat select */}
            <button
              onClick={() => {
                if (!currentCountry.allianceId) {
                  alert("يجب الانضمام لتحالف ما لتفعيل الغرف المشفرة والمغلقة الخاصة بالحلف!");
                  return;
                }
                setChatConfig('alliance', null);
              }}
              className={`w-full flex items-center justify-between text-right p-2.5 rounded text-xs transition-all cursor-pointer ${activeChatTab === 'alliance' ? 'bg-amber-500 text-slate-950 font-black' : 'hover:bg-slate-900 text-slate-400'}`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>دردشة التحلف المغلقة</span>
              </div>
              <span className="text-[10px] bg-slate-900/40 text-slate-400 px-1.5 py-0.5 rounded font-mono">حلف</span>
            </button>

            {/* Classified Private DMs */}
            <button
              onClick={() => setChatConfig('private', null)}
              className={`w-full flex items-center justify-between text-right p-2.5 rounded text-xs transition-all cursor-pointer ${activeChatTab === 'private' ? 'bg-amber-500 text-slate-950 font-black' : 'hover:bg-slate-900 text-slate-400'}`}
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>الرسائل الدبلوماسية الخاصة</span>
              </div>
              <span className="text-[10px] bg-slate-900/40 text-slate-400 px-1.5 py-0.5 rounded font-mono">خريت</span>
            </button>

          </div>

          {/* Quick Select Private recipient country list */}
          {activeChatTab === 'private' && (
            <div className="mt-4 pt-3 border-t border-slate-800/80">
              <p className="text-[10px] text-slate-500 mb-2 font-bold block">اضغط على راسل بالأسفل لإرسال رسالة دبلوماسية مشفرة:</p>
              <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                {countries
                  .filter(c => c.id !== currentCountry.id)
                  .map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setChatConfig('private', { id: c.id, name: c.name })}
                      className={`w-full text-right p-2 rounded text-[11px] hover:bg-slate-900/60 transition-all flex items-center justify-between cursor-pointer ${selectedPrivateRecipient?.id === c.id ? 'border border-amber-500/50 bg-amber-500/5 text-amber-400' : 'text-slate-300'}`}
                    >
                      <span className="flex items-center gap-1.5 direction-rtl">
                        <span>{c.flagUrl}</span>
                        <span className="truncate max-w-[120px]">{c.name}</span>
                      </span>
                      <CornerDownLeft className="w-3 h-3 text-slate-600 shrink-0" />
                    </button>
                  ))}
              </div>
            </div>
          )}

        </div>

        <div className="text-[10px] text-slate-500 mt-4 leading-relaxed bg-[#0b0f19] p-2.5 rounded border border-slate-850">
          🔒 منصات الدردشة محمية بهندسة تشفير فيدرالية وتخضع لرقابة مجلس السلم والعدالة التابع للأمم الموفقة بـ Empire Age.
        </div>
      </div>

      {/* 2. Right Workspace: Logs window and Message Sender form */}
      <div className="md:col-span-9 flex flex-col justify-between">
        
        {/* Active conversation banner metadata */}
        <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 text-xs text-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <span className="w-2 h-2 rounded bg-emerald-500 inline-block animate-ping"></span>
            <span>الناقل المحمي:</span>
            <span className="text-amber-500 uppercase tracking-wider font-extrabold font-mono">
              {activeChatTab === 'global' && 'القناة المفتوحة لجميع رؤساء الدول'}
              {activeChatTab === 'alliance' && `حجرة العمليات لحلف [${currentCountry.allianceName || 'بدون حلف'}]`}
              {activeChatTab === 'private' && (selectedPrivateRecipient ? `المراسلات الثنائية السرية لـ [${selectedPrivateRecipient.name}]` : 'حدد زعيماً من القائمة الجانبية لبدء المحادثة المشفرة')}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Real-time Feed</span>
        </div>

        {/* Scrollable messages history log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b0f19]/40">
          {displayedMessages.length === 0 ? (
            <div className="text-center py-20 text-slate-600 text-xs">
              لا توجد مناقشات أو برقيات عسكرية في هذا المذياع بعد.
            </div>
          ) : (
            displayedMessages.map((m) => {
              const isMe = m.senderId === currentCountry.id;
              const isSystem = m.senderId === 'SYSTEM';

              if (isSystem) {
                return (
                  <div key={m.id} className="mx-auto max-w-xl bg-slate-900 border border-slate-800/80 px-4 py-2.5 rounded text-xs text-center leading-relaxed">
                    <p className="text-slate-300 font-semibold">{m.text}</p>
                    <span className="text-[9px] text-slate-600 block mt-1">
                      {new Date(m.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              }

              return (
                <div 
                  key={m.id} 
                  className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[70%] rounded-lg px-3.5 py-2.5 text-xs text-right border ${isMe ? 'bg-slate-900/90 border-slate-800 text-slate-200' : 'bg-[#1e293b]/70 border-slate-700/60 text-slate-100'}`}>
                    
                    {/* Header: sender name and flag */}
                    <div className="flex items-center justify-between gap-6 mb-1 border-b border-slate-800/30 pb-0.5">
                      <span className="font-extrabold flex items-center gap-1" style={{ color: m.senderColor || '#14b8a6' }}>
                        <span>{m.senderFlagEmoji}</span>
                        <span>{m.senderCountryName}</span>
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {new Date(m.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Chat Text */}
                    <p className="leading-relaxed text-slate-300 break-words">{m.text}</p>
                    
                    {/* Private Tag indicator */}
                    {activeChatTab === 'private' && (
                      <span className="text-[8px] bg-slate-950 text-amber-500 border border-amber-500/10 px-1 py-0 rounded inline-block mt-2">
                        سري ثنائي
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Message Input form */}
        <form onSubmit={handleSendMessage} className="bg-slate-900 p-3 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            placeholder={activeChatTab === 'private' && !selectedPrivateRecipient ? "حدد حليف من الجانب لبدء الإرسال..." : "اكتب برقيتك الدبلوماسية هنا واضغط على زر الإرسال..."}
            disabled={activeChatTab === 'private' && !selectedPrivateRecipient}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 text-xs px-4 py-2.5 rounded focus:border-amber-500 focus:outline-none disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={activeChatTab === 'private' && !selectedPrivateRecipient}
            className="bg-amber-500 disabled:opacity-40 hover:bg-amber-600 text-slate-950 font-black p-2.5 rounded transition-all cursor-pointer grow-0 shrink-0"
          >
            <Send className="w-4 h-4 scale-x-[-1]" />
          </button>
        </form>

      </div>

    </div>
  );
};
