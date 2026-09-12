import React, { useState } from 'react';
import { UserCheck, Plus, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';
import { Member } from '../types.js';

interface DevBannerProps {
  members: Member[];
  activeMemberId: string;
  onSwitchMember: (memberId: string) => void;
  onAddMember: (name: string) => Promise<void>;
}

export const DevBanner: React.FC<DevBannerProps> = ({
  members,
  activeMemberId,
  onSwitchMember,
  onAddMember,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    try {
      setIsAdding(true);
      await onAddMember(newMemberName.trim());
      setNewMemberName('');
      setShowAddMember(false);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 text-xs text-slate-300 px-4 py-2">
      <div className="max-w-xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <UserCheck className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold text-slate-200">Switch Perspective:</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAddMember(!showAddMember)}
            className="flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <UserPlus className="w-3 h-3" />
            <span>Add Member</span>
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-slate-400 hover:text-slate-200"
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="max-w-xl mx-auto mt-2 pt-2 border-t border-slate-800/80">
          {/* Member Switcher Chips */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
            {members.map((m) => {
              const isActive = m.id === activeMemberId;
              return (
                <button
                  key={m.id}
                  onClick={() => onSwitchMember(m.id)}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: m.avatar_color || '#3B82F6' }}
                  />
                  <span>{m.name}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Add Member Input */}
          {showAddMember && (
            <form onSubmit={handleAdd} className="flex items-center space-x-2 mt-2">
              <input
                type="text"
                placeholder="New friend's name..."
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                autoFocus
                className="flex-1 bg-slate-950 px-3 py-1 rounded-xl border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={isAdding}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-semibold text-xs flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>{isAdding ? 'Adding...' : 'Add'}</span>
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
