import React from 'react';
import { Play } from 'lucide-react';
import { Subject } from '../types';

interface SubjectCardProps {
   subject: Subject;
   onClick: () => void;
}

export default function SubjectCard({ subject, onClick }: SubjectCardProps) {
   return (
      <div
         onClick={onClick}
         className="group relative flex flex-col h-[200px] rounded-2xl overflow-hidden glass-panel border-white/5 transition-all duration-500 cursor-pointer active:scale-98"
      >
         {/* Background Image with Overlay */}
         <div className="absolute inset-0">
            <img src={subject.image} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A1F26] via-[#1A1F26]/40 to-transparent" />
         </div>

         {/* Category Tag */}
         <div className="absolute top-2 left-2 z-10">
            <span className="btn-glass-neutral px-2 py-0.5 text-[8px] font-black tracking-tighter shadow-none">
               {subject.category}
            </span>
         </div>

         {/* Progress Indicator */}
         <div className="absolute top-2 right-2 z-10">
            <div className="glass-icon h-7 w-7 text-[8px] font-black text-accent-green">
               %{subject.progress}
            </div>
         </div>

         <div className="absolute bottom-2 left-2 right-2 p-1 flex flex-col gap-1.5">
            <div>
               <h3 className="text-sm font-bold text-white leading-[1.24]">
                  {subject.title}
               </h3>
               {subject.subtitle && (
                  <p className="text-[10px] text-white/50 font-medium line-clamp-1">
                     {subject.subtitle}
                  </p>
               )}
            </div>

            <button className="w-full btn-glass-primary py-1.5 shadow-md">
               <Play size={10} fill="currentColor" />
               <span className="text-[10px]">Başla</span>
            </button>
         </div>
      </div>
   );
}
