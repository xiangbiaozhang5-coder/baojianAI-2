import React, { useState, useEffect, useRef } from 'react';
import { Project, Character, StoryboardFrame, ToastMessage, AspectRatio, Settings } from '../types';
import { Button } from './Button';
import { ChevronLeft, Sparkles, Image as ImageIcon, RefreshCw, Maximize2, Repeat, Users, Upload, FileText, Square, UserPlus, ArrowUp, ArrowDown, Scissors, Merge, Trash2, CheckSquare, X, Plus, Play, PauseCircle, Film, Package, FileType, AlignLeft, Settings2, PenTool, Save, UserCheck, Replace, Download, FolderOutput } from 'lucide-react';
import { generateImage, inferFrameData, inferBatchPrompts, analyzeRoles, breakdownScript } from '../services/geminiService';
import { storage } from '../utils/storage';
import { parseScriptToFrames, splitLastSentence, formatScriptText } from '../utils/scriptParser';
import { exportToJianYing } from '../utils/exportUtils';
import { CharacterLibrary } from './CharacterLibrary';
import { ImageViewer } from './ImageViewer';
import { ASPECT_RATIOS } from '../constants';
import JSZip from 'jszip';

interface StoryboardEditorProps {
  project: Project;
  characters: Character[]; // Global characters
  settings: Settings; // Passed from parent
  onSave: (project: Project) => void;
  onBack: () => void;
  onUpdateCharacters: (chars: Character[]) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const StoryboardEditor: React.FC<StoryboardEditorProps> = ({ 
    project, 
    characters: globalCharacters, 
    settings,
    onSave, 
    onBack, 
    onUpdateCharacters: updateGlobalCharacters,
    showToast
}) => {
  const [frames, setFrames] = useState<StoryboardFrame[]>(project.frames);
  const [localCharacters, setLocalCharacters] = useState<Character[]>(project.localCharacters || []);
  
  // Use local characters for logic
  const allCharacters = localCharacters; 

  const [globalRatio, setGlobalRatio] = useState<AspectRatio>('4:3');
  
  // Prompt Prefix
  const DEFAULT_PREFIX = "参考图片风格，保持图中角色一致性";
  const [promptPrefix, setPromptPrefix] = useState(project.promptPrefix ?? DEFAULT_PREFIX);
  
  // UI States - Separated to allow concurrency
  const [isInferring, setIsInferring] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [loadingText, setLoadingText] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  
  // Export Images State
  const [exportModalOpen, setExportModalOpen] = useState(false);
  
  // Auto Save Status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  // Import State
  const [importText, setImportText] = useState('');
  
  const [showLocalLib, setShowLocalLib] = useState(false);
  
  // Context Menu
  const [promptImportOpen, setPromptImportOpen] = useState(false);
  const [promptImportText, setPromptImportText] = useState('');

  // Batch Replace State
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceWithText, setReplaceWithText] = useState('');
  const [replaceScope, setReplaceScope] = useState<'all' | 'selected'>('all');

  // Image Viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Stop signals
  const stopInferRef = useRef(false);
  const stopGenRef = useRef(false);
  
  const framesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-Save Effect - Optimized to 0.8s for faster response
  useEffect(() => {
    setSaveStatus('unsaved');
    const timer = setTimeout(() => {
        setSaveStatus('saving');
        onSave({...project, frames, localCharacters, promptPrefix, updatedAt: Date.now()});
        setTimeout(() => setSaveStatus('saved'), 500);
    }, 800); // 0.8s debounce (faster)
    return () => clearTimeout(timer);
  }, [frames, localCharacters, promptPrefix]);

  const handleManualSave = () => {
      onSave({...project, frames, localCharacters, promptPrefix, updatedAt: Date.now()});
      setSaveStatus('saved');
  };

  const handleBack = () => {
      // Force save before leaving
      onSave({...project, frames, localCharacters, promptPrefix, updatedAt: Date.now()});
      onBack();
  };

  // --- Stats Calculation ---
  const stats = {
      total: frames.length,
      prompts: frames.filter(f => f.visualPrompt && f.visualPrompt.trim()).length,
      images: frames.filter(f => f.imageUrl).length
  };

  // --- Helpers ---
  
  const stopAllProcess = () => {
    stopInferRef.current = true;
    stopGenRef.current = true;
    setIsInferring(false);
    setIsGenerating(false);
    setLoadingText('');
    showToast('所有任务已暂停/停止', 'info');
  };

  const scrollToFrame = (index: number) => {
    const el = document.getElementById(`frame-${index}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const findNextEmpty = (type: 'prompt' | 'image') => {
      const idx = frames.findIndex(f => type === 'prompt' ? !f.visualPrompt : !f.imageUrl);
      if (idx !== -1) {
          scrollToFrame(idx);
          showToast(`已定位到第 ${idx+1} 镜`, 'info');
      } else {
          showToast('所有分镜已完成', 'success');
      }
  };
  
  // Helper to sync character description with prompt
  const updatePromptWithChar = (prompt: string | undefined, charDesc: string, isAdding: boolean): string => {
      let current = prompt ? prompt.trim() : '';
      if (!charDesc) return current;

      const cleanDesc = charDesc.replace(/[。，,.]+$/, '');

      if (isAdding) {
          if (current.includes(cleanDesc)) return current;
          // Prepend
          if (current.length > 0) {
              return `${cleanDesc}，${current}`;
          } else {
              return cleanDesc;
          }
      } else {
          // Remove
          if (!current) return '';
          let next = current.replace(cleanDesc, '');
          next = next.replace(/，\s*，/g, '，').replace(/,\s*,/g, ',');
          next = next.replace(/，\s*,/g, '，').replace(/,\s*，/g, '，');
          next = next.replace(/^[，,\s]+/, '').replace(/[，,\s]+$/, '');
          return next;
      }
  };

  // --- Core Features ---

  const handleExportJianYing = async () => {
    // JianYing export is a heavy operation, effectively blocking
    setIsGenerating(true); 
    setLoadingText('正在打包剪映草稿...');
    try {
        await exportToJianYing({...project, frames});
        showToast('导出成功！解压后导入剪映，时间轴已自动对齐。', 'success');
    } catch (e) {
        console.error(e);
        showToast('导出失败', 'error');
    } finally {
        setIsGenerating(false);
    }
  };

  // --- Export Images Logic ---
  const handleExportImages = async (scope: 'all' | 'selected') => {
      setExportModalOpen(false);
      // Don't block inference
      setIsGenerating(true); 
      setLoadingText('正在打包图片...');
      
      try {
          const zip = new JSZip();
          const folderName = `${project.name}_images`;
          const folder = zip.folder(folderName);
          
          if (!folder) throw new Error("Zip create failed");
          
          let count = 0;
          
          for (let i = 0; i < frames.length; i++) {
              if (scope === 'selected' && !frames[i].selected) continue;
              
              const frame = frames[i];
              if (frame.imageUrl) {
                  const base64Data = frame.imageUrl.replace(/^data:image\/\w+;base64,/, "");
                  const fileName = `${(i + 1).toString().padStart(3, '0')}.png`;
                  folder.file(fileName, base64Data, { base64: true });
                  count++;
              }
          }
          
          if (count === 0) {
              showToast('没有可导出的图片', 'info');
              setIsGenerating(false);
              return;
          }
          
          const content = await zip.generateAsync({ type: "blob" });
          const url = window.URL.createObjectURL(content);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${folderName}.zip`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          showToast(`成功导出 ${count} 张图片到默认下载文件夹`, 'success');
          
      } catch (e) {
          console.error(e);
          showToast('导出图片失败', 'error');
      } finally {
          setIsGenerating(false);
      }
  };

  const handleExportSingleImage = (frameIndex: number) => {
      const frame = frames[frameIndex];
      if (!frame.imageUrl) return;
      
      const link = document.createElement('a');
      link.href = frame.imageUrl;
      link.download = `${project.name}_${(frameIndex + 1).toString().padStart(3, '0')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('图片已保存到下载文件夹', 'success');
  };

  const handleSmartBreakdown = async () => {
    if (!importText) return;
    setIsInferring(true);
    setLoadingText('正在智能拆解剧本...');
    stopInferRef.current = false;
    
    try {
        const scenes = await breakdownScript(importText, settings);
        if (stopInferRef.current) return;
        handleScriptOverride(scenes);
    } catch (e: any) {
        showToast(e.message || '智能分镜失败', 'error');
        setIsInferring(false);
    }
  };

  const handleTxtFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const text = await file.text();
          setImportText(text);
          showToast('TXT 内容已读取', 'success');
      }
  };

  const handleCustomScriptImport = () => {
      if (!importText) return;
      const lines = parseScriptToFrames(importText);
      handleScriptOverride(lines);
  };

  const handleScriptOverride = (newLines: string[]) => {
      if (frames.length === 0) {
          const newFrames: StoryboardFrame[] = newLines.map(text => ({
            id: `f_${Date.now()}_${Math.random()}`,
            scriptContent: formatScriptText(text),
            characterIds: [],
            aspectRatio: globalRatio,
            model: settings.imageModel
          }));
          setFrames(newFrames);
          finishImport(`成功创建 ${newFrames.length} 个分镜`);
          return;
      }

      const oldFrames = [...frames];
      const newCount = newLines.length;
      const oldCount = oldFrames.length;

      const mergedFrames: StoryboardFrame[] = [];

      for (let i = 0; i < newCount; i++) {
          const text = newLines[i];
          const startIndex = Math.floor(i * (oldCount / newCount));
          const endIndex = Math.floor((i + 1) * (oldCount / newCount)) - 1;
          const validStart = Math.min(Math.max(0, startIndex), oldCount - 1);
          const validEnd = Math.min(Math.max(validStart, endIndex), oldCount - 1);
          
          const startFrame = oldFrames[validStart];
          const endFrame = oldFrames[validEnd];

          let startTime = startFrame.startTime;
          let endTime = endFrame.endTime;
          
          mergedFrames.push({
              id: `f_merged_${Date.now()}_${i}`,
              scriptContent: formatScriptText(text),
              startTime: startTime,
              endTime: endTime,
              characterIds: [], 
              aspectRatio: globalRatio,
              model: settings.imageModel,
              visualPrompt: '' 
          });
      }

      setFrames(mergedFrames);
      finishImport(`已将 ${oldCount} 个SRT分镜合并为 ${newCount} 个自定义分镜，时间轴已保留`);
  };

  const finishImport = (msg: string) => {
      setImportModalOpen(false);
      setImportText('');
      setIsInferring(false);
      showToast(msg, 'success');
  };

  // --- Global Settings ---

  const handleGlobalRatioChange = (ratio: AspectRatio) => {
      setGlobalRatio(ratio);
      if (confirm(`是否将现有所有分镜的比例修改为 ${ratio} ?`)) {
          setFrames(prev => prev.map(f => ({ ...f, aspectRatio: ratio })));
          showToast('全局比例已更新', 'success');
      }
  };

  // --- AI & Prompts (BATCH ENHANCED) ---

  const handleInferAllPrompts = async () => {
    if (allCharacters.length === 0) {
        showToast('建议先在角色库添加角色，以便AI识别。', 'info');
    }

    setIsInferring(true);
    stopInferRef.current = false;
    
    // Fixed Batch size of 5 for context retention and stability
    const BATCH_SIZE = 5;
    const totalFrames = frames.length;
    let prevContextSummary = "";

    // IMPORTANT: Iterate with awaits to not flood the API, but checks stops.
    // UI is NOT blocked for generating images while this runs, as we use functional updates.
    for (let i = 0; i < totalFrames; i += BATCH_SIZE) {
        if (stopInferRef.current) break;
        
        const end = Math.min(i + BATCH_SIZE, totalFrames);
        const batchIndices = [];
        const batchScripts = [];
        
        for (let j = i; j < end; j++) {
            batchIndices.push(j);
            batchScripts.push(frames[j].scriptContent);
        }
        
        // Only show loading text if not generating (avoid conflict)
        if (!isGenerating) {
             setLoadingText(`推理中 ${i + 1}-${end}/${totalFrames} (批量生成含景别描述)...`);
        }

        try {
            const results = await inferBatchPrompts(batchScripts, allCharacters, settings, prevContextSummary);
            
            // Update context for next batch (use the last script of this batch)
            prevContextSummary = batchScripts[batchScripts.length - 1];

            // FUNCTIONAL STATE UPDATE to avoid race conditions with image generation
            setFrames(prevFrames => {
                const newFrames = [...prevFrames];
                
                results.forEach((res, idx) => {
                   const globalIdx = batchIndices[idx];
                   if (globalIdx < newFrames.length && res.prompt) {
                       // Map active names to IDs
                       const activeIds = allCharacters
                            .filter(c => res.activeNames.includes(c.name))
                            .map(c => c.id);
                       
                       const mergedIds = Array.from(new Set([...activeIds, ...newFrames[globalIdx].characterIds]));

                       newFrames[globalIdx] = {
                           ...newFrames[globalIdx],
                           visualPrompt: res.prompt,
                           characterIds: activeIds.length > 0 ? activeIds : newFrames[globalIdx].characterIds
                       };
                   }
                });
                return newFrames;
            });

        } catch (e) {
            console.error("Batch error", e);
            // Continue to next batch instead of stopping entirely
        }
    }
    
    setIsInferring(false);
    if (!stopInferRef.current) showToast('全剧推理完成', 'success');
  };

  const handleSingleInfer = (index: number) => {
      const frame = frames[index];
      const prevContext = frames.slice(Math.max(0, index - 5), index).map(f => f.scriptContent);
      const nextContext = frames.slice(index + 1, Math.min(frames.length, index + 4)).map(f => f.scriptContent);
      
      setLoadingText('单图深度推理中...');
      setIsInferring(true);
      
      inferFrameData(frame.scriptContent, allCharacters, settings, prevContext, nextContext).then(({ prompt, activeNames }) => {
          if (prompt && prompt.trim().length > 0) {
              const activeIds = allCharacters
                .filter(c => activeNames.includes(c.name))
                .map(c => c.id);

              // Safe functional update
              setFrames(prev => {
                  const nf = [...prev];
                  nf[index] = { 
                      ...nf[index], 
                      visualPrompt: prompt, 
                      characterIds: activeIds 
                  };
                  return nf;
              });
          } else {
              showToast('推理未生成有效内容，保留原描述', 'info');
          }
          setIsInferring(false);
      }).catch((e: any) => {
          setIsInferring(false);
          showToast(e.message || '推理请求失败', 'error');
      });
  };

  const handleImportPrompts = () => {
     const lines = promptImportText.split('\n').filter(l => l.trim());
     setFrames(prev => {
         const nf = [...prev];
         let count = 0;
         lines.forEach((line, idx) => {
             if (nf[idx]) {
                 nf[idx].visualPrompt = line;
                 count++;
             }
         });
         return nf;
     });
     setPromptImportOpen(false);
     setPromptImportText('');
     showToast(`导入完成`, 'success');
  };

  const handleClearAllPrompts = () => {
      if (confirm('确定要清空所有画面描述词吗？此操作不可撤销。')) {
          setFrames(prev => prev.map(f => ({ ...f, visualPrompt: '' })));
          showToast('已清空描述词', 'success');
      }
  };

  const handleBatchReplace = () => {
      if (!findText) return;
      
      let updatedCount = 0;
      setFrames(prev => {
          return prev.map(frame => {
              const shouldProcess = replaceScope === 'all' || (replaceScope === 'selected' && frame.selected);
              
              if (shouldProcess && frame.visualPrompt) {
                  if (frame.visualPrompt.includes(findText)) {
                       const newPrompt = frame.visualPrompt.split(findText).join(replaceWithText);
                       updatedCount++;
                       return { ...frame, visualPrompt: newPrompt };
                  }
              }
              return frame;
          });
      });
      
      setReplaceModalOpen(false);
      showToast(`成功在 ${updatedCount} 个分镜中执行替换`, 'success');
  };

  // --- Character Management ---
  
  const handleAutoMatchRoles = async () => {
      let count = 0;
      setFrames(prev => {
          return prev.map(f => {
              const script = f.scriptContent;
              const matches = allCharacters.filter(c => script.includes(c.name));
              if (matches.length > 0) {
                   const existing = new Set(f.characterIds);
                   let changed = false;
                   matches.forEach(m => {
                       if (!existing.has(m.id)) {
                           existing.add(m.id);
                           changed = true;
                       }
                   });
                   if (changed) {
                       count++;
                       return { ...f, characterIds: Array.from(existing) };
                   }
              }
              return f;
          });
      });
      showToast(`已通过关键词快速匹配角色`, 'success');
  };

  const handleSmartExtractRoles = async () => {
    setIsInferring(true);
    setLoadingText('正在分析剧本角色...');
    try {
        const fullScript = frames.map(f => f.scriptContent).join('\n');
        const analyzedChars = await analyzeRoles(fullScript, settings);
        
        const newChars = analyzedChars.filter(ac => 
            !localCharacters.some(lc => lc.name === ac.name)
        ).map((c: any) => ({
            ...c,
            id: `char_local_${Date.now()}_${Math.random().toString(36).substr(2,5)}`
        })) as Character[];

        if (newChars.length > 0) {
            setLocalCharacters(prev => [...prev, ...newChars]);
            setShowLocalLib(true);
            showToast(`成功提取 ${newChars.length} 个新角色`, 'success');
        } else {
            showToast('未发现新角色或角色已存在', 'info');
        }
    } catch (e: any) {
        console.error("Smart extract failed", e);
        showToast(e.message || '角色分析失败', 'error');
    } finally {
        setIsInferring(false);
    }
  };

  const handleImportFromGlobal = (char: Character) => {
      if (localCharacters.some(c => c.name === char.name)) {
          showToast(`角色 ${char.name} 已存在于本项目`, 'info');
          return;
      }
      const charCopy = { ...char, id: `local_copy_${Date.now()}_${Math.random().toString(36).substr(2,5)}` };
      setLocalCharacters(prev => [...prev, charCopy]);
      showToast(`已导入 ${char.name}`, 'success');
  };

  const handlePromoteToGlobal = (char: Character) => {
      if (globalCharacters.some(c => c.name === char.name)) {
          showToast(`全局库已存在 ${char.name}`, 'info');
          return;
      }
      const charCopy = { ...char, id: `global_${Date.now()}_${Math.random().toString(36).substr(2,5)}` };
      updateGlobalCharacters([...globalCharacters, charCopy]);
      showToast(`已保存 ${char.name} 到全局库`, 'success');
  };

  const handleRemoveCharacterFromFrame = (frameIndex: number, charId: string) => {
      setFrames(prev => {
          const nf = [...prev];
          const frame = nf[frameIndex];
          const charToRemove = allCharacters.find(c => c.id === charId);

          nf[frameIndex].characterIds = frame.characterIds.filter(id => id !== charId);
          
          if (charToRemove) {
              nf[frameIndex].visualPrompt = updatePromptWithChar(frame.visualPrompt, charToRemove.description, false);
          }
          return nf;
      });
  };

  // --- Image Handling ---

  const handleGenerateImage = async (idx: number, isHD: boolean = false) => {
    if (!frames[idx].visualPrompt) return showToast('请先生成画面描述词', 'error');
    
    // Only show text if not inferring (avoid visual conflict)
    if (!isInferring) setLoadingText(isHD ? '高清生图中...' : '生图中...');
    
    setIsGenerating(true);
    stopGenRef.current = false;
    
    try {
        if (stopGenRef.current) return;
        
        let referenceImage: string | undefined = undefined;
        if (frames[idx].characterIds.length > 0) {
            const mainChar = allCharacters.find(c => c.id === frames[idx].characterIds[0]);
            referenceImage = mainChar?.referenceImage;
        } else {
            // Contextual Fallback
            for (let k = idx - 1; k >= Math.max(0, idx - 5); k--) {
                if (frames[k].characterIds.length > 0) {
                    const fallbackChar = allCharacters.find(c => c.id === frames[k].characterIds[0]);
                    if (fallbackChar?.referenceImage) {
                        referenceImage = fallbackChar.referenceImage;
                        break;
                    }
                }
            }
        }
        
        const fullPrompt = promptPrefix ? `${promptPrefix}, ${frames[idx].visualPrompt!}` : frames[idx].visualPrompt!;
        
        const img = await generateImage(
            fullPrompt, 
            settings, 
            frames[idx].aspectRatio,
            referenceImage, 
            isHD
        );
        
        if (!stopGenRef.current) {
             setFrames(prev => {
                 const nf = [...prev];
                 nf[idx] = { ...nf[idx], imageUrl: img, isHD: isHD };
                 return nf;
             });
             showToast('生图成功', 'success');
        }
    } catch(e: any) {
        if (!stopGenRef.current) showToast(e.message || '生图失败', 'error');
    } finally {
        setIsGenerating(false);
    }
  };

  const handleBatchGenerateImages = async () => {
    setIsGenerating(true);
    stopGenRef.current = false;
    
    const pendingIndices = frames.map((f, i) => ({ f, i })).filter(item => !item.f.imageUrl && item.f.visualPrompt);
    
    if (pendingIndices.length === 0) {
        setIsGenerating(false);
        showToast('没有待生成的图片', 'info');
        return;
    }

    let successCount = 0;
    
    for (let k = 0; k < pendingIndices.length; k++) {
        if (stopGenRef.current) break;

        const { i, f } = pendingIndices[k];

        if (!isInferring) setLoadingText(`批量生图 ${k + 1}/${pendingIndices.length} (点击暂停)...`);
        scrollToFrame(i);
        
        try {
            let referenceImage: string | undefined = undefined;
            if (f.characterIds.length > 0) {
                 const mainChar = allCharacters.find(c => c.id === f.characterIds[0]);
                 referenceImage = mainChar?.referenceImage;
            } else {
                 for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
                      if (frames[j].characterIds.length > 0) {
                           const fallbackChar = allCharacters.find(c => c.id === frames[j].characterIds[0]);
                           if (fallbackChar?.referenceImage) {
                               referenceImage = fallbackChar.referenceImage;
                               break;
                           }
                      }
                 }
            }
            
            const fullPrompt = promptPrefix ? `${promptPrefix}, ${f.visualPrompt!}` : f.visualPrompt!;

            const img = await generateImage(
                fullPrompt, 
                settings, 
                f.aspectRatio,
                referenceImage,
                false
            );

            if (!stopGenRef.current) {
                // Strict functional update prevents overwriting inferring data
                setFrames(prev => {
                    const nf = [...prev];
                    nf[i] = { ...nf[i], imageUrl: img };
                    return nf;
                });
                successCount++;
            }
        } catch (e) {
            console.error(`Frame ${i} failed`, e);
        }
    }
    
    setIsGenerating(false);
    showToast(`批量任务结束/暂停，本轮生成 ${successCount} 张`, 'info');
  };

  const handleDropImage = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = () => {
              setFrames(prev => {
                  const nf = [...prev];
                  nf[index].imageUrl = reader.result as string;
                  return nf;
              });
              showToast('图片导入成功', 'success');
          };
          reader.readAsDataURL(file);
      }
  };

  // --- Frame Operations ---

  const handleSplit = (index: number) => {
      const current = frames[index];
      const [stay, move] = splitLastSentence(current.scriptContent);
      if (!move) {
          showToast('无法拆分', 'info');
          return;
      }
      setFrames(prev => {
          const nf = [...prev];
          nf[index] = { ...current, scriptContent: stay };
          nf.splice(index + 1, 0, {
              ...current,
              id: `f_${Date.now()}`,
              scriptContent: move,
              visualPrompt: '',
              imageUrl: undefined,
              aspectRatio: current.aspectRatio,
              model: current.model
          });
          return nf;
      });
      showToast('拆分成功', 'success');
  };

  const handleMerge = (index: number) => {
      if (index >= frames.length - 1) return;
      setFrames(prev => {
          const nf = [...prev];
          const current = nf[index];
          const next = nf[index + 1];
          nf[index] = {
              ...current,
              scriptContent: current.scriptContent + (current.scriptContent ? '\n' : '') + next.scriptContent,
          };
          nf.splice(index + 1, 1);
          return nf;
      });
      showToast('合并成功', 'success');
  };

  const toggleSelect = (index: number) => {
      setFrames(prev => {
          const nf = [...prev];
          nf[index].selected = !nf[index].selected;
          return nf;
      });
  };

  // --- Render ---

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 1. Header with Stats */}
      <div className="bg-white border-b border-gray-200 shadow-sm z-20">
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Button variant="secondary" onClick={handleBack} size="sm">
                    <ChevronLeft size={16} /> 返回
                </Button>
                <div>
                    <input 
                        className="font-bold text-gray-900 text-lg border-none focus:ring-0 p-0"
                        value={project.name}
                        onChange={(e) => onSave({...project, name: e.target.value})}
                    />
                    <div className="flex items-center gap-2 mt-1 cursor-pointer" onClick={handleManualSave} title="点击手动保存">
                        {saveStatus === 'saving' && <span className="text-[10px] text-gray-400 flex items-center"><RefreshCw size={10} className="animate-spin mr-1"/>保存中...</span>}
                        {saveStatus === 'saved' && <span className="text-[10px] text-green-500 flex items-center"><Save size={10} className="mr-1"/>已保存</span>}
                        {saveStatus === 'unsaved' && <span className="text-[10px] text-orange-400 flex items-center"><AlignLeft size={10} className="mr-1"/>未保存(点击保存)</span>}
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                 {/* Prompt Prefix Input */}
                 <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 max-w-xs transition-colors focus-within:border-[var(--brand-color)] focus-within:ring-1 focus-within:ring-[var(--brand-color)]">
                    <PenTool size={14} className="text-gray-400" />
                    <input 
                        className="text-xs bg-transparent border-none focus:ring-0 text-gray-800 p-0 w-48 placeholder-gray-400"
                        value={promptPrefix || ''}
                        onChange={(e) => setPromptPrefix(e.target.value)}
                        placeholder="画面描述词前缀..."
                        title="此内容将作为前缀添加到所有画面描述词中"
                    />
                 </div>

                 {/* Aspect Ratio Selector */}
                 <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                    <Settings2 size={14} className="text-gray-500" />
                    <span className="text-xs text-gray-500 font-medium">全剧比例:</span>
                    <select 
                        className="text-xs bg-transparent border-none focus:ring-0 text-gray-800 font-bold p-0 cursor-pointer"
                        value={globalRatio}
                        onChange={(e) => handleGlobalRatioChange(e.target.value as AspectRatio)}
                    >
                        {ASPECT_RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                 </div>

                {/* Stats Bar */}
                <div className="flex items-center gap-6 text-sm bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-600">
                        <FileText size={16} />
                        <span>分镜: <b className="text-gray-900">{stats.total}</b></span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-600">
                        <Sparkles size={16} />
                        <span>描述词: <b className="text-gray-900">{stats.prompts}</b></span>
                    </div>
                    <div className="flex items-center gap-2 text-green-600">
                        <ImageIcon size={16} />
                        <span>已生图: <b className="text-gray-900">{stats.images}</b></span>
                    </div>
                </div>
            </div>
          </div>
          
          {/* 2. Colorful Toolbar */}
          <div className="px-6 py-3 bg-white border-t border-gray-100 flex items-center gap-3 overflow-x-auto shadow-inner">
                {/* Character & Script Group */}
                <div className="flex gap-2 p-1 bg-gray-50 rounded-lg border border-gray-100">
                    <Button size="sm" onClick={() => setShowLocalLib(true)} className="bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20 border-transparent">
                        <Users size={16} className="mr-2" /> 角色库
                    </Button>
                    <Button size="sm" onClick={handleAutoMatchRoles} className="bg-cyan-500 hover:bg-cyan-600 text-white shadow-cyan-500/20 border-transparent" title="扫描剧本并自动勾选对应角色(快速匹配)">
                        <UserCheck size={16} className="mr-2" /> 快速匹配
                    </Button>
                    <Button size="sm" onClick={() => setImportModalOpen(true)} className="bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20 border-transparent">
                        <Upload size={16} className="mr-2" /> 导入自定义
                    </Button>
                </div>

                {/* AI Tools Group */}
                <div className="flex gap-2 p-1 bg-gray-50 rounded-lg border border-gray-100">
                    <Button size="sm" onClick={() => setImportModalOpen(true)} disabled={isInferring} className="bg-pink-500 hover:bg-pink-600 text-white shadow-pink-500/20 border-transparent disabled:opacity-50 disabled:cursor-not-allowed">
                        <Film size={16} className="mr-2" /> AI 智能分镜
                    </Button>
                    <Button size="sm" onClick={handleSmartExtractRoles} disabled={isInferring} className="bg-teal-500 hover:bg-teal-600 text-white shadow-teal-500/20 border-transparent disabled:opacity-50 disabled:cursor-not-allowed">
                        <UserPlus size={16} className="mr-2" /> AI 提取
                    </Button>
                </div>

                {/* Editing Group */}
                <div className="flex gap-2 p-1 bg-gray-50 rounded-lg border border-gray-100">
                    <Button size="sm" onClick={() => {
                        setFindText('');
                        setReplaceWithText('');
                        setReplaceScope(frames.some(f => f.selected) ? 'selected' : 'all');
                        setReplaceModalOpen(true);
                    }} className="bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20 border-transparent">
                        <Replace size={16} className="mr-2" /> 批量替换
                    </Button>
                    <Button size="sm" onClick={handleClearAllPrompts} className="bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20 border-transparent">
                        <Trash2 size={16} className="mr-2" /> 清空描述
                    </Button>
                </div>

                <div className="w-px h-8 bg-gray-300 mx-1"></div>

                {/* Action Group */}
                <div className="flex gap-2">
                     <Button 
                        size="sm" 
                        onClick={handleInferAllPrompts}
                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setPromptImportOpen(true); }}
                        disabled={isInferring}
                        className="bg-[var(--brand-color)] hover:brightness-110 text-white shadow-[var(--brand-color)]/30 border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        title="自动识别角色、动作、环境并生成描述词 (含景别)"
                    >
                        {isInferring ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Sparkles size={16} className="mr-2" />} 
                        {isInferring ? '推理中...' : '批量推理'}
                    </Button>

                    <Button size="sm" onClick={handleBatchGenerateImages} disabled={isGenerating} className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 border-transparent disabled:opacity-50 disabled:cursor-not-allowed">
                        {isGenerating ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Play size={16} className="mr-2" />} 
                        {isGenerating ? '生图中...' : '批量生图'}
                    </Button>

                    <Button size="sm" onClick={() => setExportModalOpen(true)} className="bg-gray-800 hover:bg-gray-900 text-white shadow-gray-800/20 border-transparent">
                         <FolderOutput size={16} className="mr-2" /> 导出图片
                    </Button>
                    
                    <Button size="sm" onClick={handleExportJianYing} className="bg-violet-600 hover:bg-violet-700 text-white shadow-violet-600/20 border-transparent">
                         <Package size={16} className="mr-2" /> 导出剪映
                    </Button>
                </div>

                {/* Stop Button (Global) */}
                {(isInferring || isGenerating) && (
                    <Button variant="danger" size="sm" onClick={stopAllProcess} className="px-4 ml-2 animate-in fade-in zoom-in">
                        <PauseCircle size={16} className="mr-2 fill-current" /> 停止
                    </Button>
                )}
          </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden relative">
         {/* Frames List */}
         <div ref={framesContainerRef} className="flex-1 overflow-y-auto p-6 bg-gray-100 relative">
            
            {/* Loading Overlay (Non-blocking) */}
            {(isInferring || isGenerating) && loadingText && (
                <div className="fixed top-24 right-8 z-40 bg-black/80 text-white px-4 py-2 rounded-lg flex items-center shadow-lg backdrop-blur-md border border-white/20 animate-in fade-in slide-in-from-top-4 pointer-events-auto">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-[var(--brand-color)] border-t-transparent mr-3"></div>
                    <span className="text-xs font-medium mr-4">{loadingText}</span>
                    <button onClick={stopAllProcess} className="text-red-400 hover:text-red-300 font-bold text-xs bg-white/10 px-2 py-1 rounded">停止</button>
                </div>
            )}

            <div className="max-w-[95%] mx-auto space-y-3 pb-20">
                {frames.map((frame, index) => (
                    <div 
                        key={frame.id} 
                        id={`frame-${index}`}
                        className={`bg-white rounded-lg shadow-sm border transition-all duration-200 overflow-hidden ${frame.selected ? 'border-[var(--brand-color)] ring-2 ring-[var(--brand-color)]/20' : 'border-gray-200'}`}
                    >
                        {/* Horizontal Layout Container */}
                        <div className="flex items-start h-auto">
                            
                            {/* Column 1: Index & Controls */}
                            <div className="w-12 bg-gray-50 border-r border-gray-100 flex flex-col items-center py-2 shrink-0 self-stretch">
                                <span className="font-bold text-gray-500 text-sm mb-2">#{index + 1}</span>
                                <input 
                                    type="checkbox" 
                                    checked={frame.selected || false} 
                                    onChange={() => toggleSelect(index)}
                                    className="w-4 h-4 text-[var(--brand-color)] rounded border-gray-300 mb-2 focus:ring-[var(--brand-color)]"
                                />
                                <div className="flex flex-col gap-1 mt-auto pb-2">
                                     <button onClick={() => handleSplit(index)} className="p-1 hover:bg-gray-200 rounded text-gray-500" title="拆分"><Scissors size={14}/></button>
                                     <button onClick={() => handleMerge(index)} className="p-1 hover:bg-gray-200 rounded text-gray-500" title="合并"><Merge size={14}/></button>
                                     <button onClick={() => setFrames(prev => prev.filter(f => f.id !== frame.id))} className="p-1 hover:bg-red-50 hover:text-red-500 rounded text-gray-500" title="删除"><X size={14}/></button>
                                </div>
                            </div>

                            {/* Column 2: Content (Auto-Format on blur) */}
                            <div className="flex-1 p-2 border-r border-gray-100 min-w-[200px]">
                                <div className="text-[10px] font-bold text-gray-400 mb-1 flex justify-between">
                                    <span>剧本/内容</span>
                                    {frame.startTime && <span>{frame.startTime}</span>}
                                </div>
                                <textarea 
                                    className="w-full h-full min-h-[100px] p-2 border border-gray-200 rounded bg-gray-50 text-sm focus:ring-[var(--brand-color)] resize-none"
                                    value={frame.scriptContent}
                                    onChange={e => {
                                        setFrames(prev => {
                                            const nf = [...prev];
                                            nf[index].scriptContent = e.target.value;
                                            return nf;
                                        });
                                    }}
                                    onBlur={() => {
                                        setFrames(prev => {
                                            const nf = [...prev];
                                            nf[index].scriptContent = formatScriptText(nf[index].scriptContent);
                                            return nf;
                                        });
                                    }}
                                />
                            </div>

                            {/* Column 3: Prompt */}
                            <div className="flex-1 p-2 border-r border-gray-100 min-w-[200px]">
                                <div className="text-[10px] font-bold text-blue-400 mb-1 flex justify-between items-center">
                                    <span>画面描述词 (AI将自动加入景别)</span>
                                    <button 
                                        onClick={() => handleSingleInfer(index)}
                                        disabled={isInferring}
                                        className="text-[10px] bg-blue-50 text-blue-600 px-1.5 rounded hover:bg-blue-100 disabled:opacity-50"
                                    >
                                        推理
                                    </button>
                                </div>
                                <textarea 
                                    className="w-full h-full min-h-[100px] p-2 border border-blue-100 rounded bg-blue-50 text-sm focus:ring-blue-500 font-mono text-blue-800 resize-none"
                                    value={frame.visualPrompt || ''}
                                    onChange={e => {
                                        setFrames(prev => {
                                            const nf = [...prev];
                                            nf[index].visualPrompt = e.target.value;
                                            return nf;
                                        });
                                    }}
                                    placeholder="描述词..."
                                />
                            </div>

                            {/* Column 4: Roles with Delete */}
                            <div className="w-40 p-2 border-r border-gray-100 shrink-0">
                                <div className="text-[10px] font-bold text-gray-400 mb-1 flex justify-between">
                                    <span>角色</span>
                                    <button onClick={() => setShowLocalLib(true)}><UserPlus size={12}/></button>
                                </div>
                                <div className="flex flex-col gap-1 max-h-[100px] overflow-y-auto">
                                    {allCharacters.map(char => {
                                        const isSelected = frame.characterIds.includes(char.id);
                                        return (
                                        <div key={char.id} className={`flex items-center justify-between px-1.5 py-0.5 rounded border text-[10px] truncate ${
                                            isSelected ? 'bg-[var(--brand-color)]/10 border-[var(--brand-color)] text-[var(--brand-color)]' : 'bg-white border-gray-100 text-gray-500 opacity-60 hover:opacity-100'
                                        }`}>
                                            <div 
                                                className="flex-1 cursor-pointer flex items-center"
                                                onClick={() => {
                                                    setFrames(prev => {
                                                        const nf = [...prev];
                                                        const f = nf[index];
                                                        const ids = new Set(f.characterIds);
                                                        
                                                        if (!isSelected) {
                                                            // ADD (Prepend)
                                                            ids.add(char.id);
                                                            nf[index].visualPrompt = updatePromptWithChar(f.visualPrompt, char.description, true);
                                                        } else {
                                                            // REMOVE
                                                            ids.delete(char.id); 
                                                            nf[index].visualPrompt = updatePromptWithChar(f.visualPrompt, char.description, false);
                                                        }

                                                        nf[index].characterIds = Array.from(ids);
                                                        return nf;
                                                    });
                                                }}
                                            >
                                                <span className="truncate">{char.name}</span>
                                            </div>
                                            {isSelected && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemoveCharacterFromFrame(index, char.id);
                                                    }}
                                                    className="ml-1 text-red-400 hover:text-red-600"
                                                >
                                                    <X size={10} />
                                                </button>
                                            )}
                                        </div>
                                    )})}
                                </div>
                            </div>

                            {/* Column 5: Image (Fixed Width) */}
                            <div className="w-64 p-2 shrink-0 flex flex-col gap-2">
                                <div 
                                    className={`relative bg-gray-900 rounded border border-gray-200 w-full overflow-hidden group ${frame.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'}`}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleDropImage(e, index)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (frame.imageUrl) {
                                            handleExportSingleImage(index);
                                        }
                                    }}
                                >
                                    <input 
                                        type="file" 
                                        id={`file-input-${index}`} 
                                        hidden 
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if(file) {
                                                const reader = new FileReader();
                                                reader.onload = () => {
                                                    setFrames(prev => {
                                                        const nf = [...prev];
                                                        nf[index].imageUrl = reader.result as string;
                                                        return nf;
                                                    });
                                                    showToast('图片导入成功', 'success');
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />

                                    {frame.imageUrl ? (
                                        <>
                                            <img 
                                                src={frame.imageUrl} 
                                                className={`w-full h-full object-contain cursor-zoom-in ${frame.isMirrored ? 'scale-x-[-1]' : ''}`} 
                                                alt="Scene" 
                                                onClick={() => {
                                                    setViewerIndex(index);
                                                    setViewerOpen(true);
                                                }}
                                            />
                                            {/* Action Overlay */}
                                            <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleExportSingleImage(index);
                                                    }}
                                                    className="bg-black/50 hover:bg-black/70 text-white rounded p-1"
                                                    title="导出图片 (或右键点击)"
                                                >
                                                    <Download size={12} />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div 
                                            className="w-full h-full flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:text-gray-300"
                                            onClick={() => handleGenerateImage(index)}
                                        >
                                            <ImageIcon size={24} className="opacity-50 mb-1"/>
                                            <span className="text-[10px]">点击生图</span>
                                        </div>
                                    )}
                                    {frame.isHD && <div className="absolute top-1 left-1 bg-yellow-400 text-black text-[9px] font-bold px-1 rounded pointer-events-none">HD</div>}
                                </div>
                                
                                {/* Image Controls Row */}
                                <div className="flex justify-between items-center px-1">
                                    <div className="flex gap-1">
                                        <button onClick={() => handleGenerateImage(index)} className="p-1 hover:bg-gray-100 rounded text-gray-600" title="重新生图"><RefreshCw size={14}/></button>
                                        <button onClick={() => {
                                            setFrames(prev => {
                                                const nf = [...prev];
                                                nf[index].isMirrored = !nf[index].isMirrored;
                                                return nf;
                                            });
                                        }} disabled={!frame.imageUrl} className="p-1 hover:bg-gray-100 rounded text-gray-600 disabled:opacity-30" title="镜像"><Repeat size={14}/></button>
                                        <button onClick={() => handleGenerateImage(index, true)} disabled={!frame.visualPrompt} className="p-1 hover:bg-gray-100 rounded text-gray-600 disabled:opacity-30" title="高清"><Maximize2 size={14}/></button>
                                    </div>
                                    <select 
                                        className="text-[10px] border border-gray-200 rounded bg-transparent text-gray-500"
                                        value={frame.aspectRatio}
                                        onChange={(e) => {
                                            setFrames(prev => {
                                                const nf = [...prev];
                                                nf[index].aspectRatio = e.target.value as any;
                                                return nf;
                                            });
                                        }}
                                    >
                                        {ASPECT_RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                <Button className="w-full py-4 border-2 border-dashed border-gray-300 text-gray-500 bg-transparent hover:bg-gray-50 rounded-xl" onClick={() => {
                    setFrames(prev => [...prev, { 
                        id: `f_${Date.now()}`, 
                        scriptContent: '', 
                        characterIds: [], 
                        aspectRatio: globalRatio, // Use global default
                        model: settings.imageModel 
                    }]);
                }}>
                    <Plus size={20} className="mr-2" /> 添加新分镜
                </Button>
            </div>
         </div>

         {/* Local Lib Sidebar */}
         {showLocalLib && (
            <div className="absolute top-0 right-0 bottom-0 w-96 bg-white shadow-2xl z-30 border-l border-gray-200 flex flex-col animate-in slide-in-from-right duration-300">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-bold flex items-center gap-2">
                        <Users size={18}/> 本剧角色库
                    </h3>
                    <button onClick={() => setShowLocalLib(false)} className="hover:bg-gray-200 p-1 rounded"><X size={18}/></button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <CharacterLibrary 
                        characters={localCharacters}
                        onAddCharacter={(c) => setLocalCharacters([...localCharacters, c])}
                        onUpdateCharacter={(c) => setLocalCharacters(localCharacters.map(x => x.id === c.id ? c : x))}
                        onDeleteCharacter={(id) => setLocalCharacters(localCharacters.filter(x => x.id !== id))}
                        title=""
                        compact
                        globalCharacters={globalCharacters}
                        onImportFromGlobal={handleImportFromGlobal}
                        onExportToGlobal={handlePromoteToGlobal}
                    />
                </div>
            </div>
         )}
      </div>

      {/* Floating Navigation */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-2 z-30">
          <button onClick={() => findNextEmpty('prompt')} className="bg-white p-3 rounded-full shadow-lg hover:bg-brand-50 text-[var(--brand-color)] border border-gray-200" title="下一个无描述词">
               <FileText size={20} />
          </button>
          <button onClick={() => findNextEmpty('image')} className="bg-white p-3 rounded-full shadow-lg hover:bg-brand-50 text-green-600 border border-gray-200" title="下一个无图">
               <ImageIcon size={20} />
          </button>
          <div className="h-px bg-gray-300 w-full my-1"></div>
          <button onClick={() => framesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} className="bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700" title="回到顶部">
               <ArrowUp size={20} />
          </button>
          <button onClick={() => framesContainerRef.current?.scrollTo({ top: 99999, behavior: 'smooth' })} className="bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700" title="去到底部">
               <ArrowDown size={20} />
          </button>
      </div>

      {/* Modals */}

      {/* Export Images Modal */}
      {exportModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg w-full max-w-sm p-6 shadow-xl animate-in fade-in zoom-in-95">
                  <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                      <FolderOutput size={20} className="text-gray-700" /> 导出图片
                  </h3>
                  <p className="text-sm text-gray-500 mb-6">
                      选择导出范围。图片将打包为 ZIP 下载到浏览器的默认下载文件夹中。
                  </p>
                  
                  <div className="space-y-3">
                      <button 
                        onClick={() => handleExportImages('all')}
                        className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:border-brand-500 hover:bg-brand-50 transition-all flex items-center justify-between group"
                      >
                          <span className="font-medium text-gray-700 group-hover:text-brand-700">全部图片 ({frames.filter(f=>f.imageUrl).length} 张)</span>
                          <CheckSquare className="opacity-0 group-hover:opacity-100 text-brand-500" size={16} />
                      </button>

                      <button 
                        onClick={() => handleExportImages('selected')}
                        className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:border-brand-500 hover:bg-brand-50 transition-all flex items-center justify-between group"
                        disabled={!frames.some(f => f.selected && f.imageUrl)}
                      >
                          <span className={`font-medium ${!frames.some(f => f.selected && f.imageUrl) ? 'text-gray-400' : 'text-gray-700 group-hover:text-brand-700'}`}>
                             仅选中的图片 ({frames.filter(f => f.selected && f.imageUrl).length} 张)
                          </span>
                          <CheckSquare className="opacity-0 group-hover:opacity-100 text-brand-500" size={16} />
                      </button>
                  </div>

                  <div className="flex justify-end mt-6">
                      <Button variant="ghost" onClick={() => setExportModalOpen(false)}>取消</Button>
                  </div>
              </div>
          </div>
      )}

      {/* Batch Replace Modal */}
      {replaceModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Replace size={20} className="text-[var(--brand-color)]"/> 批量替换描述词
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">查找内容 (Find)</label>
                        <input 
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--brand-color)] outline-none"
                            value={findText}
                            onChange={e => setFindText(e.target.value)}
                            placeholder="输入要查找的文字..."
                            autoFocus
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">替换为 (Replace with)</label>
                        <input 
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--brand-color)] outline-none"
                            value={replaceWithText}
                            onChange={e => setReplaceWithText(e.target.value)}
                            placeholder="输入替换后的文字 (留空则为删除)"
                        />
                    </div>
                    
                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-2">应用范围</label>
                         <div className="flex gap-4">
                             <label className="flex items-center gap-2 cursor-pointer">
                                 <input 
                                    type="radio" 
                                    name="scope" 
                                    checked={replaceScope === 'all'} 
                                    onChange={() => setReplaceScope('all')}
                                    className="text-[var(--brand-color)] focus:ring-[var(--brand-color)]"
                                 />
                                 <span className="text-sm">全部分镜</span>
                             </label>
                             <label className="flex items-center gap-2 cursor-pointer">
                                 <input 
                                    type="radio" 
                                    name="scope" 
                                    checked={replaceScope === 'selected'} 
                                    onChange={() => setReplaceScope('selected')}
                                    className="text-[var(--brand-color)] focus:ring-[var(--brand-color)]"
                                    disabled={!frames.some(f => f.selected)}
                                 />
                                 <span className={`text-sm ${!frames.some(f => f.selected) ? 'text-gray-400' : ''}`}>
                                    仅选中分镜 ({frames.filter(f => f.selected).length})
                                 </span>
                             </label>
                         </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="ghost" onClick={() => setReplaceModalOpen(false)}>取消</Button>
                    <Button onClick={handleBatchReplace} disabled={!findText}>执行替换</Button>
                </div>
            </div>
        </div>
      )}
      
      {/* Script Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        <FileText size={20} className="text-[var(--brand-color)]"/> 导入自定义分镜
                    </h3>
                    <button onClick={() => setImportModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                             <AlignLeft className="text-orange-500" size={16} />
                             <h4 className="font-bold text-orange-800 text-sm">操作说明</h4>
                        </div>
                        <ul className="list-disc list-inside text-xs text-orange-700 space-y-1">
                            <li>此功能将使用您的文本内容<b>直接覆盖</b>现有分镜的文字。</li>
                            <li>如果您已上传 SRT，系统将智能<b>合并/拆分时间轴</b>，保留原SRT的总时长。</li>
                            <li>例如：原SRT有40行，您导入20行自定义分镜，系统会将40个时间片段合并为20个。</li>
                        </ul>
                    </div>

                    <div className="flex flex-col h-full space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                自定义剧本内容
                            </label>
                            <div className="flex gap-2">
                                <label className="text-[10px] text-blue-500 cursor-pointer hover:underline flex items-center gap-1">
                                     <Upload size={10} /> 加载 TXT
                                     <input type="file" accept=".txt" hidden onChange={handleTxtFileLoad} />
                                </label>
                            </div>
                        </div>
                        <textarea 
                            className="w-full h-48 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none font-mono"
                            placeholder="在此粘贴您的分镜内容，每行一个分镜..."
                            value={importText}
                            onChange={e => setImportText(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <Button size="sm" variant="secondary" onClick={handleSmartBreakdown} disabled={!importText || isInferring} className="text-purple-600">
                             <Sparkles size={14} className="mr-2" /> 
                             AI 智能辅助拆解 (可选)
                        </Button>

                        <Button 
                            onClick={handleCustomScriptImport} 
                            disabled={!importText} 
                        >
                            <CheckSquare size={16} className="mr-2" /> 
                            确认导入并覆盖
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Prompt Bulk Import */}
      {promptImportOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg w-full max-w-lg p-6 shadow-xl">
                  <h3 className="font-bold text-lg mb-4">批量导入画面描述词</h3>
                  <p className="text-sm text-gray-500 mb-2">每行对应一个分镜，将按顺序填充到已有分镜中。</p>
                  <textarea 
                      className="w-full h-64 border border-gray-300 rounded p-2 text-sm font-mono"
                      placeholder="第一镜描述...&#10;第二镜描述..."
                      value={promptImportText}
                      onChange={e => setPromptImportText(e.target.value)}
                  />
                  <div className="flex justify-end gap-2 mt-4">
                      <Button variant="ghost" onClick={() => setPromptImportOpen(false)}>取消</Button>
                      <Button onClick={handleImportPrompts}>确认填充</Button>
                  </div>
              </div>
          </div>
      )}

      {/* Image Viewer */}
      <ImageViewer 
          isOpen={viewerOpen}
          imageUrl={frames[viewerIndex]?.imageUrl || ''}
          onClose={() => setViewerOpen(false)}
          onNext={() => viewerIndex < frames.length - 1 ? setViewerIndex(viewerIndex + 1) : null}
          onPrev={() => viewerIndex > 0 ? setViewerIndex(viewerIndex - 1) : null}
      />

    </div>
  );

  function onSaveAndBack() {
      onSave({...project, frames, localCharacters});
      onBack();
  }
};