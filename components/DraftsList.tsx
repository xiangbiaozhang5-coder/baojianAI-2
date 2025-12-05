import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { Button } from './Button';
import { Search, Plus, Trash2, Edit2, Copy, FileText, CheckSquare, Upload } from 'lucide-react';

interface DraftsListProps {
  projects: Project[];
  onDelete: (id: string) => void;
  onEdit: (project: Project) => void;
  onCreate: (name: string, srtFile: File | null) => void;
}

export const DraftsList: React.FC<DraftsListProps> = ({ projects, onDelete, onEdit, onCreate }) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [srtFile, setSrtFile] = useState<File | null>(null);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, id: string} | null>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const formatDate = (ts: number) => new Date(ts).toLocaleString('zh-CN', { 
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
  });

  const handleCreateSubmit = () => {
      const name = newProjectName.trim() || `草稿 ${projects.length + 1}`;
      onCreate(name, srtFile);
      setIsCreateModalOpen(false);
      setNewProjectName('');
      setSrtFile(null);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">创作草稿箱</h1>
        <div className="flex items-center space-x-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="搜索草稿..." 
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none w-64 text-sm"
                />
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)} className="shadow-lg shadow-brand-500/30">
                <Plus size={18} className="mr-2" />
                新建剧本
            </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div className="col-span-1 text-center">序号</div>
            <div className="col-span-5">草稿名称</div>
            <div className="col-span-4">时间信息</div>
            <div className="col-span-2 text-right">操作</div>
        </div>

        <div className="divide-y divide-gray-100">
            {projects.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                    <FileText size={48} className="mx-auto mb-4 opacity-20" />
                    <p>暂无草稿，请创建新的创作。</p>
                </div>
            ) : projects.map((project, idx) => (
                <div 
                    key={project.id} 
                    className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 transition-colors group cursor-pointer"
                    onClick={() => onEdit(project)}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation(); // Stop propagation to prevent immediate close if parent has listener
                        setContextMenu({ x: e.clientX, y: e.clientY, id: project.id });
                    }}
                >
                     <div className="col-span-1 text-center font-mono text-gray-400">
                        {idx + 1}
                     </div>
                     <div className="col-span-5 flex items-center space-x-4">
                        <div className="w-10 h-10 rounded bg-brand-50 flex items-center justify-center text-brand-500 shrink-0">
                             <FileText size={18} />
                        </div>
                        <div>
                            <h3 className="font-medium text-gray-900 group-hover:text-brand-600 transition-colors">
                                {project.name}
                            </h3>
                            <p className="text-xs text-gray-500">{project.frames.length} 个分镜</p>
                        </div>
                     </div>
                     <div className="col-span-4 text-xs text-gray-500">
                        <div className="mb-0.5">创建: {formatDate(project.createdAt)}</div>
                        <div>更新: {formatDate(project.updatedAt)}</div>
                     </div>
                     <div className="col-span-2 flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onEdit(project); }} 
                            className="p-1.5 hover:bg-brand-50 text-gray-500 hover:text-brand-600 rounded-md" 
                            title="编辑"
                        >
                            <Edit2 size={16} />
                        </button>
                     </div>
                </div>
            ))}
        </div>
      </div>
      
      {/* Context Menu */}
      {contextMenu && (
          <div 
            className="fixed bg-white border border-gray-200 shadow-xl rounded-lg py-1 z-50 w-32 animate-in fade-in zoom-in-95 duration-100"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside menu container
          >
              <button 
                onClick={(e) => { 
                    e.stopPropagation(); // Stop bubbling to window
                    setContextMenu(null); // Close menu
                    setTimeout(() => onDelete(contextMenu.id), 50); // Delay execution to allow menu to close before confirm dialog
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                  <Trash2 size={14} /> 删除草稿
              </button>
          </div>
      )}

      {/* Create Project Modal */}
      {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
                  <h3 className="font-bold text-lg mb-4">新建剧本</h3>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">剧本名称</label>
                          <input 
                              type="text" 
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                              placeholder="例如：科幻短片 EP01"
                              value={newProjectName}
                              onChange={e => setNewProjectName(e.target.value)}
                          />
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">初始 SRT 字幕 (可选)</label>
                          <p className="text-xs text-gray-500 mb-2">上传 SRT 可直接生成带时间轴的分镜。</p>
                          <label className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${srtFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                                <input type="file" accept=".srt" hidden onChange={e => setSrtFile(e.target.files?.[0] || null)} />
                                {srtFile ? (
                                    <div className="text-center">
                                        <CheckSquare className="mx-auto text-green-500 mb-1" size={20} />
                                        <span className="text-xs text-green-700 font-medium break-all px-2">{srtFile.name}</span>
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <Upload className="mx-auto mb-1" size={20} />
                                        <span className="text-xs">点击上传 .srt</span>
                                    </div>
                                )}
                          </label>
                      </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                      <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>取消</Button>
                      <Button onClick={handleCreateSubmit}>开始创作</Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};