"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Users, PlayCircle, Timer, FileText, Image as ImageIcon, Link as LinkIcon, Check, Mic, MicOff, Video, VideoOff, Circle, CheckCircle2, CheckSquare, List as ListIcon, LayoutDashboard, CalendarDays, MessageSquare } from "lucide-react";

// Individual Mini Mockups

function VaultMockup() {
  const [activeId, setActiveId] = useState<number | null>(null);

  const files = [
    { id: 1, name: "Physics_Notes.pdf", icon: FileText, color: "bg-[#0057FF]" },
    { id: 2, name: "Reference_Image.png", icon: ImageIcon, color: "bg-[#FF3CAC]" },
    { id: 3, name: "Project_Links", icon: LinkIcon, color: "bg-[#FF6B00]" },
  ];

  return (
    <div className="w-full h-full min-h-[300px] bg-background rounded-[1.5rem] p-6 border-2 border-foreground flex flex-col gap-4 relative">
      <div className="flex justify-between items-center bg-card border-2 border-foreground p-3 rounded-xl shadow-[3px_3px_0px_black]">
        <div className="text-sm font-display font-bold">My Vault</div>
        <div className="bg-[#FFD600] text-xs font-bold px-2 py-1 rounded-md border border-foreground">New</div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 flex-1 relative">
        {files.map((f) => (
          <motion.div
            key={f.id}
            layoutId={`vault-card-${f.id}`}
            onClick={() => setActiveId(f.id)}
            className="bg-card border-2 border-foreground rounded-xl p-3 shadow-[3px_3px_0px_black] cursor-pointer hover:bg-neutral-50 flex flex-col gap-2"
          >
            <div className={`w-8 h-8 rounded-md border border-foreground flex items-center justify-center text-white ${f.color}`}>
              <f.icon className="w-4 h-4" />
            </div>
            <div className="text-xs font-mono font-medium truncate">{f.name}</div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {activeId && (
          <motion.div
            className="absolute inset-4 bg-card border-2 border-foreground rounded-[1.5rem] shadow-[6px_6px_0px_black] z-10 p-4 flex flex-col cursor-pointer"
            layoutId={`vault-card-${activeId}`}
            onClick={() => setActiveId(null)}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-md border-2 border-foreground flex items-center justify-center text-white ${files.find((f) => f.id === activeId)?.color}`}>
                {files.find(f => f.id === activeId)?.icon && (() => {
                  const Icon = files.find(f => f.id === activeId)!.icon;
                  return <Icon className="w-5 h-5" />;
                })()}
              </div>
              <div className="text-sm font-mono font-bold truncate">
                {files.find((f) => f.id === activeId)?.name}
              </div>
            </div>
            <div className="flex-1 bg-background border-2 border-foreground rounded-xl flex items-center justify-center relative overflow-hidden">
               <div className="w-3/4 space-y-2">
                 <div className="h-4 w-full bg-foreground/10 rounded-md" />
                 <div className="h-4 w-5/6 bg-foreground/10 rounded-md" />
                 <div className="h-4 w-4/6 bg-foreground/10 rounded-md" />
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CommunityMockup() {
  const [joined, setJoined] = useState(false);
  const [confetti, setConfetti] = useState<{ id: number; x: number; y: number; color: string }[]>([]);

  const handleJoin = (e: React.MouseEvent) => {
    if (joined) return;
    setJoined(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const colors = ["#FFD600", "#0057FF", "#FF3CAC", "#00C853", "#FF6B00"];
    const burst = Array.from({ length: 15 }).map((_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 100,
      y: -Math.random() * 100 - 50,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    setConfetti(burst);
  };

  return (
    <div className="w-full h-full min-h-[300px] bg-card rounded-[1.5rem] border-2 border-foreground shadow-[6px_6px_0px_black] overflow-hidden flex flex-col relative">
      <div className="h-24 bg-[#00C853] border-b-2 border-foreground px-6 pt-6 relative flex items-end">
        <div className="absolute top-4 right-4 flex -space-x-2">
          <div className="w-6 h-6 rounded-full border-2 border-foreground bg-[#FFD600]" />
          <div className="w-6 h-6 rounded-full border-2 border-foreground bg-card" />
          <div className="w-6 h-6 rounded-full border-2 border-foreground bg-[#FF3CAC]" />
        </div>
      </div>
      <div className="px-6 pb-6 pt-4 flex-1 flex flex-col">
        <div className="font-display font-extrabold text-xl mb-1">Advanced Algorithms</div>
        <div className="text-sm font-sans text-muted-foreground">CS301 • 124 members</div>
        
        <div className="mt-4 flex gap-2">
           <div className="h-16 w-1/2 bg-background border-2 border-foreground rounded-xl p-2 flex items-start gap-2">
             <div className="w-6 h-6 rounded border border-foreground bg-[#FFD600]" />
             <div className="flex-1 space-y-1 mt-1">
               <div className="h-2 bg-foreground/20 rounded w-full" />
               <div className="h-2 bg-foreground/20 rounded w-2/3" />
             </div>
           </div>
           <div className="h-16 w-1/2 bg-background border-2 border-foreground rounded-xl p-2 flex items-start gap-2">
             <div className="w-6 h-6 rounded border border-foreground bg-[#0057FF]" />
             <div className="flex-1 space-y-1 mt-1">
               <div className="h-2 bg-foreground/20 rounded w-full" />
               <div className="h-2 bg-foreground/20 rounded w-1/2" />
             </div>
           </div>
        </div>

        <div className="mt-auto pt-4 relative">
          <button 
            onClick={handleJoin}
            className={`w-full py-2.5 rounded-xl border-2 border-foreground font-display font-bold transition-all ${
              joined ? "bg-card text-foreground shadow-[2px_2px_0px_black] translate-x-[2px] translate-y-[2px]" : "bg-[#FFD600] text-foreground shadow-[4px_4px_0px_black] hover:bg-[#FFD600]/90"
            } flex items-center justify-center gap-2`}
          >
            {joined ? <><CheckCircle2 className="w-5 h-5 text-[#00C853]" /> Joined</> : "Join Community"}
          </button>
          
          {confetti.map((c) => (
            <motion.div
              key={c.id}
              initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
              animate={{ x: c.x, y: c.y, scale: 1, opacity: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute left-1/2 bottom-8 w-3 h-3 rounded-full border border-foreground pointer-events-none"
              style={{ backgroundColor: c.color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CircleMockup() {
  const [mic, setMic] = useState(false);
  const [cam, setCam] = useState(false);

  return (
    <div className="w-full h-full min-h-[300px] bg-[#1E1E1E] text-white rounded-[1.5rem] border-2 border-foreground shadow-[6px_6px_0px_black] p-2 flex flex-col gap-2 relative">
      <div className="flex gap-2 h-[45%]">
        <div className="flex-1 bg-[#2D2D2D] border-2 border-foreground rounded-xl overflow-hidden relative group">
          {cam ? (
             <div className="absolute inset-0 bg-[#FFD600] flex items-center justify-center text-foreground font-display font-bold text-2xl">YOU</div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-500"><Users /></div>
          )}
          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
            <span className="text-xs bg-foreground/50 px-2 py-0.5 rounded font-mono">Me</span>
            <div className={`w-2 h-2 rounded-full ${mic ? 'bg-[#00C853]' : 'bg-[#FF3B30]'}`} />
          </div>
        </div>
        <div className="w-[30%] flex flex-col gap-2">
           <div className="flex-1 bg-[#4285F4] border-2 border-foreground rounded-xl flex items-center justify-center">
             <span className="font-display font-bold text-lg">AJ</span>
           </div>
           <div className="flex-1 bg-[#FF6B00] border-2 border-foreground rounded-xl flex items-center justify-center">
             <span className="font-display font-bold text-lg">MK</span>
           </div>
        </div>
      </div>
      <div className="flex-1 bg-card border-2 border-foreground rounded-xl relative overflow-hidden p-4">
        {/* Whiteboard content */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100">
          <motion.path
            d="M20 50 Q 50 10, 80 50 T 140 50"
            fill="none"
            stroke="#FF3B30"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
          />
        </svg>
        <motion.div 
          className="absolute w-4 h-4 rounded-full bg-foreground shadow-lg"
          animate={{ x: [80, 140, 80], y: [50, 50, 50] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
        />
        <div className="absolute bottom-2 left-2 text-foreground font-mono text-[10px] font-bold">Whiteboard Live</div>
      </div>
      
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-foreground border-2 border-card/20 p-2 rounded-2xl">
        <button onClick={() => setMic(!mic)} className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 border-foreground ${mic ? 'bg-card text-foreground' : 'bg-[#FF3B30] text-white'}`}>
          {mic ? <Mic className="w-5 h-5"/> : <MicOff className="w-5 h-5"/>}
        </button>
        <button onClick={() => setCam(!cam)} className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 border-foreground ${cam ? 'bg-card text-foreground' : 'bg-[#FF3B30] text-white'}`}>
          {cam ? <Video className="w-5 h-5"/> : <VideoOff className="w-5 h-5"/>}
        </button>
      </div>
    </div>
  );
}

function FocusMockup() {
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(25 * 60);

  useEffect(() => {
    let int: NodeJS.Timeout;
    if (running && time > 0) {
      int = setInterval(() => {
        setTime((t) => t - 1);
      }, 1000);
    }
    return () => clearInterval(int);
  }, [running, time]);

  const mins = Math.floor(time / 60).toString().padStart(2, '0');
  const secs = (time % 60).toString().padStart(2, '0');
  const progress = ((25 * 60 - time) / (25 * 60)) * 100;

  return (
    <div className="w-full h-full min-h-[300px] bg-[#FF3CAC] rounded-[1.5rem] border-2 border-foreground shadow-[6px_6px_0px_black] p-6 flex flex-col items-center justify-center relative overflow-hidden text-white">
      <div className="font-mono text-xs uppercase tracking-widest font-bold mb-4 bg-foreground/20 px-3 py-1 rounded-full border border-foreground/20">Focus Session</div>
      
      <div className="relative w-40 h-40 flex items-center justify-center">
        {/* Background ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="50%" cy="50%" r="45%" fill="none" stroke="black" strokeWidth="8" strokeOpacity="0.1" />
          <motion.circle 
            cx="50%" cy="50%" r="45%" 
            fill="none" 
            stroke="#FFD600" 
            strokeWidth="8" 
            pathLength={progress / 100}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="font-display font-extrabold text-5xl tracking-tighter text-foreground drop-shadow-md">
          {mins}:{secs}
        </div>
      </div>

      <button 
        onClick={() => setRunning(!running)}
        className="mt-6 bg-card border-2 border-foreground text-foreground font-display font-bold px-8 py-3 rounded-xl shadow-[4px_4px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_black] transition-all"
      >
        {running ? "Pause" : "Start"}
      </button>
    </div>
  );
}

function TasksMockup() {
  type Priority = "high" | "medium" | "low";
  const [tasks, setTasks] = useState([
    { id: 1, title: "Finish assignment draft", priority: "high" as Priority, category: "Uni",      completed: false },
    { id: 2, title: "Buy groceries",           priority: "low"  as Priority, category: "Personal", completed: true  },
    { id: 3, title: "Review PR comments",      priority: "medium" as Priority, category: "Work",  completed: false },
    { id: 4, title: "Morning run",             priority: "low"  as Priority, category: "Health",  completed: false },
  ]);

  const toggle = (id: number) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );

  const doneCount = tasks.filter((t) => t.completed).length;

  const priorityDot: Record<Priority, string> = {
    high:   "bg-red-500",
    medium: "bg-amber-400",
    low:    "bg-green-500",
  };

  return (
    <div className="w-full h-full min-h-[300px] bg-card rounded-[1.5rem] border-[3px] border-foreground shadow-[8px_8px_0px_black] p-4 flex flex-col gap-3">
      {/* View toggle pills */}
      <div className="flex items-center gap-1.5">
        {([
          { label: "List",     Icon: ListIcon       },
          { label: "Kanban",   Icon: LayoutDashboard },
          { label: "Calendar", Icon: CalendarDays    },
        ] as const).map(({ label, Icon }) => (
          <div
            key={label}
            className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-foreground ${
              label === "List"
                ? "bg-[#7C3AED] text-white"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            <Icon className="w-2.5 h-2.5" />
            {label}
          </div>
        ))}
      </div>

      {/* Quick-add bar */}
      <div className="flex items-center gap-2 bg-secondary border-2 border-foreground rounded-xl px-3 py-2">
        <span className="flex-1 text-xs text-muted-foreground font-sans">Add a task...</span>
        <div className="w-5 h-5 rounded-md border border-black bg-[#7C3AED] flex items-center justify-center text-white font-bold text-xs leading-none">
          +
        </div>
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-2 flex-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-2.5 bg-secondary border border-foreground/20 rounded-xl px-3 py-2"
          >
            {/* Checkbox */}
            <motion.button
              onClick={() => toggle(task.id)}
              whileTap={{ scale: 1.2 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className={`w-4 h-4 rounded border-[1.5px] border-foreground flex-shrink-0 flex items-center justify-center ${
                task.completed ? "bg-[#7C3AED]" : "bg-card"
              }`}
            >
              {task.completed && (
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              )}
            </motion.button>

            {/* Title */}
            <span
              className={`flex-1 text-xs font-sans font-medium truncate transition-all ${
                task.completed ? "line-through opacity-50" : "text-foreground"
              }`}
            >
              {task.title}
            </span>

            {/* Category badge */}
            <span className="text-[9px] font-mono text-muted-foreground bg-card border border-foreground/10 px-1.5 py-0.5 rounded-full">
              {task.category}
            </span>

            {/* Priority dot */}
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 border border-black/20 ${priorityDot[task.priority]}`}
            />
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="text-[10px] font-mono text-muted-foreground/60 text-right">
        {doneCount} of {tasks.length} done
      </div>
    </div>
  );
}

function ThreadsMockup() {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [upCount, setUpCount] = useState(14);
  const [downCount, setDownCount] = useState(3);
  const [showExtra, setShowExtra] = useState(false);

  const handleVote = (dir: "up" | "down") => {
    if (vote === dir) {
      // deselect
      setVote(null);
      if (dir === "up") setUpCount((c) => c - 1);
      else setDownCount((c) => c - 1);
    } else {
      // switching sides
      if (vote === "up") setUpCount((c) => c - 1);
      if (vote === "down") setDownCount((c) => c - 1);
      setVote(dir);
      if (dir === "up") setUpCount((c) => c + 1);
      else setDownCount((c) => c + 1);
    }
  };

  return (
    <div className="w-full h-full min-h-[300px] bg-card rounded-[1.5rem] border-[3px] border-foreground shadow-[8px_8px_0px_black] p-4 flex flex-col gap-3">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <span className="font-display font-bold text-sm">Threads</span>
        <div className="flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border border-foreground bg-secondary text-muted-foreground cursor-default">
          + New Post
        </div>
      </div>

      {/* Main post */}
      <div className="bg-secondary border border-foreground/20 rounded-xl p-3 flex flex-col gap-2">
        {/* Author row */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#7C3AED] border border-black flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
            AK
          </div>
          <span className="text-xs font-bold font-mono">akshat_k</span>
          <span className="text-[10px] text-[#999] font-sans ml-1">2h ago</span>
          <div className="ml-auto">
            <ImageIcon className="w-3 h-3 text-[#bbb]" />
          </div>
        </div>

        {/* Post title */}
        <p className="text-xs font-sans font-semibold text-foreground leading-snug">
          Anyone else struggling with the DSA assignment? Specifically the graph traversal part
        </p>

        {/* Category tag */}
        <span className="self-start text-[9px] font-mono text-muted-foreground bg-card border border-foreground/10 px-2 py-0.5 rounded-full">
          Uni • CSE
        </span>

        {/* Vote + reply row */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => handleVote("up")}
            className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border transition-all ${
              vote === "up"
                ? "bg-[#FFD600] border-black text-black"
                : "bg-white dark:bg-[#1E1D1A] border-black/20 dark:border-black text-[#555] dark:!text-white"
            }`}
          >
            ▲ {upCount}
          </button>
          <button
            onClick={() => handleVote("down")}
            className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border transition-all ${
              vote === "down"
                ? "bg-red-100 dark:bg-[#2A1616] border-red-400 text-red-500 dark:!text-[#FF8A80]"
                : "bg-white dark:bg-[#1E1D1A] border-black/20 dark:border-black text-[#555] dark:!text-white"
            }`}
          >
            ▼ {downCount}
          </button>
          <button className="flex items-center gap-1 text-[10px] font-mono text-[#888] ml-1">
            💬 4 replies
          </button>
        </div>
      </div>

      {/* Replies */}
      <div className="flex flex-col gap-1.5 pl-1">
        {/* Reply 1 */}
        <div className="bg-secondary border border-foreground/10 rounded-xl p-2.5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-[#00C853] border border-black flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
              RV
            </div>
            <span className="text-[10px] font-bold font-mono">riya_v</span>
            <span className="text-[9px] text-[#bbb] ml-1">1h ago</span>
          </div>
          <p className="text-[10px] font-sans text-[#333] leading-snug">
            Yes! The BFS part tripped me up. Try visualizing it with a queue diagram first.
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] font-mono text-[#bbb]">▲ 6</span>
            <button className="text-[9px] font-mono text-[#bbb]">↩ reply</button>
          </div>
        </div>

        {/* Reply 2 — sub-reply, indented */}
        <div className="ml-4 border-l-2 border-[#A78BFA] pl-2">
          <div className="bg-[#F5F5F0] dark:bg-secondary border border-black/10 dark:border-foreground/10 rounded-xl p-2.5 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-[#4285F4] border border-black flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
                SM
              </div>
              <span className="text-[10px] font-bold font-mono">sam_m</span>
              <span className="text-[9px] text-[#bbb] ml-1">45m ago</span>
            </div>
            <p className="text-[10px] font-sans text-[#333] dark:!text-white leading-snug">
              agreed with riya — also check the lecture notes from week 8
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-mono text-[#bbb]">▲ 3</span>
              <button className="text-[9px] font-mono text-[#bbb]">↩ reply</button>
            </div>
          </div>
        </div>

        {/* Collapsed expander */}
        <AnimatePresence>
          {showExtra && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-secondary border border-foreground/10 rounded-xl p-2.5 flex flex-col gap-1"
            >
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-[#FF6B00] border border-black flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
                  PK
                </div>
                <span className="text-[10px] font-bold font-mono">priya_k</span>
                <span className="text-[9px] text-[#bbb] ml-1">30m ago</span>
              </div>
              <p className="text-[10px] font-sans text-foreground/80 leading-snug">
                Prof uploaded a hint sheet in the Vault btw 👀
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-mono text-[#bbb]">▲ 2</span>
                <button className="text-[9px] font-mono text-[#bbb]">↩ reply</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setShowExtra((v) => !v)}
          className="text-[10px] font-mono text-[#A78BFA] hover:underline text-left"
        >
          {showExtra ? "Hide replies" : "View 2 more replies..."}
        </button>
      </div>
    </div>
  );
}

const features = [
  {
    id: "vault",
    title: "Personal Vault",
    desc: "Your private storage layer for every note, PDF, script, and link. Organise with tags and folders. Sync seamlessly.",
    tags: ["20MB/file", "Rich Text Notes", "Global Search"],
    icon: Copy,
    color: "bg-[#0057FF]",
    mockup: VaultMockup
  },
  {
    id: "communities",
    title: "Communities",
    desc: "Find your course or create a study group. Share files directly from your Vault without creating duplicates.",
    tags: ["Up to 250 members", "Shared Folders", "Task Tracking"],
    icon: Users,
    color: "bg-[#00C853]",
    mockup: CommunityMockup
  },
  {
    id: "circles",
    title: "Study Circles",
    desc: "Jump into ephemeral real-time rooms. Talk, share screens, and draw on a collaborative whiteboard together.",
    tags: ["5-person Voice/Video", "Live Whiteboard", "No link required"],
    icon: PlayCircle,
    color: "bg-[#FF6B00]",
    mockup: CircleMockup
  },
  {
    id: "focus",
    title: "Focus Dashboard",
    desc: "Track your study sessions with built-in timers. Climb your community's leaderboard and view personal analytics.",
    tags: ["Auto Pomodoro", "Leaderboards", "Data Charts"],
    icon: Timer,
    color: "bg-[#FF3CAC]",
    mockup: FocusMockup
  },
  {
    id: "tasks",
    title: "Personal Tasks",
    desc: "Manage your daily grind with a built-in task manager. Switch between Kanban, List, and Calendar views seamlessly.",
    tags: ["Kanban Board", "Priority Levels", "Subtasks"],
    icon: CheckSquare,
    color: "bg-[#7C3AED]",
    mockup: TasksMockup
  },
  {
    id: "threads",
    title: "Threads",
    desc: "Ask questions, share knowledge, and discuss ideas with your community. Upvote answers, reply to replies, and attach images to posts.",
    tags: ["Q&A Forum", "Upvotes", "Nested Replies"],
    icon: MessageSquare,
    color: "bg-[#800000]",
    mockup: ThreadsMockup
  }
];

export default function FeatureSection() {
  return (
    <section className="py-32 bg-card block w-full">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8">
        
        <div className="text-center mb-24 flex flex-col items-center">
           <h1 className="font-display font-extrabold text-4xl sm:text-6xl text-foreground">
             Six tools. One login.
           </h1>
        </div>

        <div className="space-y-24">
          {features.map((feat, idx) => {
            const isEven = idx % 2 === 0;
            const ContentSide = () => (
              <div className="flex-1 flex flex-col gap-6 items-start justify-center">
                <div className={`w-16 h-16 rounded-[1rem] border-[3px] border-foreground shadow-[4px_4px_0px_black] flex items-center justify-center ${feat.color} text-white`}>
                  <feat.icon className="w-8 h-8" />
                </div>
                <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground">
                  {feat.title}
                </h2>
                <p className="font-sans text-lg text-muted-foreground max-w-md">
                  {feat.desc}
                </p>
                <div className="flex flex-wrap gap-2">
                  {feat.tags.map(tag => (
                    <div key={tag} className="font-mono text-xs font-bold text-foreground bg-[#FFD600] px-3 py-1.5 rounded-full border-2 border-foreground">
                      {tag}
                    </div>
                  ))}
                </div>
              </div>
            );

            const MockupSide = () => (
              <div className="flex-[1.2] w-full max-w-xl mx-auto md:max-w-none">
                <feat.mockup />
              </div>
            );

            return (
              <motion.div
                key={feat.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={`p-8 md:p-12 lg:p-16 bg-card border-[3px] border-foreground rounded-[2rem] shadow-[8px_8px_0px_black] flex flex-col gap-12 lg:gap-16 relative overflow-hidden ${
                  isEven ? "lg:flex-row" : "lg:flex-row-reverse"
                }`}
              >
                <ContentSide />
                <MockupSide />
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
