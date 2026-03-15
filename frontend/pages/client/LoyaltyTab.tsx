import React, { useState, useEffect } from 'react';
import { Card, Button, StatusModal, Badge } from '../../components/ui';
import { Settings2 } from 'lucide-react';
import { PointMovement, Contact, PlanType } from '../../types';
import api from '../../services/api';
import { Award, Plus, Trash2 } from 'lucide-react';

interface LevelConfig {
   name: string;
   goal: number;
   reward: string;
   points_per_visit: number;
   days_to_downgrade: number;
   points_per_signup: number;
   active?: boolean;
}

const defaultLevels: LevelConfig[] = [
   { name: 'Bronze', goal: 10, reward: '', points_per_visit: 1, points_per_signup: 1, days_to_downgrade: 0, active: true },
   { name: 'Prata', goal: 20, reward: '', points_per_visit: 2, points_per_signup: 1, days_to_downgrade: 30, active: true },
   { name: 'Ouro', goal: 30, reward: '', points_per_visit: 3, points_per_signup: 1, days_to_downgrade: 30, active: true },
   { name: 'Diamante', goal: 50, reward: '', points_per_visit: 5, points_per_signup: 1, days_to_downgrade: 30, active: true } // Valor padrão ajustado para 5 conforme solicitado
];

interface LoyaltyTabProps {
   tenantPlan?: PlanType;
   contacts?: Contact[];
}

export const LoyaltyTab: React.FC<LoyaltyTabProps> = ({ tenantPlan, contacts = [] }) => {
   const [pointHistory, setPointHistory] = useState<PointMovement[]>([]);
   const [loyaltySettings, setLoyaltySettings] = useState({
      loyalty_active: true,
      points_goal: 10,
      signup_bonus_points: 1,
      description: '',
      rules_text: '',
      levels_config: [] as LevelConfig[]
   });
   const [isLoading, setIsLoading] = useState(false);
   const [modal, setModal] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      type: 'success' | 'error' | 'info' | 'warning';
      onConfirm?: () => void;
      confirmLabel?: string;
   }>({
      isOpen: false,
      title: '',
      message: '',
      type: 'info'
   });

   useEffect(() => {
      fetchLoyaltySettings();
   }, []);

   const fetchLoyaltySettings = async () => {
      try {
         const res = await api.get('/client/loyalty/settings');
         if (res.data) {
            setLoyaltySettings(prev => ({
               ...prev,
               ...res.data,
               levels_config: res.data.levels_config?.length > 0 ? res.data.levels_config : defaultLevels
            }));
         }
      } catch (error) {
         console.error('Error fetching loyalty settings:', error);
      }
   };

   const fetchHistory = async () => {
      setPointHistory([]);
   };

   const handleUpdateSettings = async () => {
      setIsLoading(true);
      try {
         await api.patch('/client/loyalty/settings', loyaltySettings);
         setModal({
            isOpen: true,
            title: 'Sucesso!',
            message: 'Configurações de fidelidade atualizadas com sucesso.',
            type: 'success'
         });
      } catch (error) {
         setModal({
            isOpen: true,
            title: 'Erro ao Salvar',
            message: 'Não foi possível atualizar as configurações.',
            type: 'error'
         });
      } finally {
         setIsLoading(false);
      }
   };

   return (
      <div className="space-y-6 animate-fade-in pb-12">
         <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Programa de Fidelidade</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-lg">Organize suas regras e pontuações do seu programa.</p>
         </div>

         <div className="space-y-12">
            {/* CONFIGURAÇÃO GERAL */}
            <div className="space-y-6">
               <Card className="p-8 border-none shadow-sm w-full">
                  <div className="space-y-5">
                     <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white pb-2 border-b border-gray-100 dark:border-gray-800">
                        <Settings2 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        Configuração Geral
                     </h3>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Descrição do Programa de Fidelidade</label>
                        <textarea
                           value={loyaltySettings.description || ''}
                           onChange={(e) => setLoyaltySettings({ ...loyaltySettings, description: e.target.value })}
                           placeholder="Ex: Participe do nosso programa VIP e ganhe prêmios exclusivos a cada visita. A cada nível alcançado, novos benefícios são liberados!"
                           className="w-full h-24 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[15px] font-medium text-sm outline-none focus:ring-2 focus:ring-primary-500/20 transition-all resize-none"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                           Regras do Programa <span className="text-[10px] font-bold text-primary-500/70 lowercase tracking-normal">(cada linha será um tópico)</span>
                        </label>
                        <textarea
                           value={loyaltySettings.rules_text || ''}
                           onChange={(e) => setLoyaltySettings({ ...loyaltySettings, rules_text: e.target.value })}
                           placeholder="Ex:&#10;Ganhe 1 ponto a cada ¥ 5.000 em compras.&#10;Resgate seus prêmios em qualquer dia da semana.&#10;Mantenha-se ativo para não perder seu nível VIP."
                           className="w-full h-32 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[15px] font-medium text-sm outline-none focus:ring-2 focus:ring-primary-500/20 transition-all resize-none leading-relaxed"
                        />
                     </div>


                  </div>
               </Card>
            </div>

            {/* NÍVEIS DO PROGRAMA */}
            <div className="space-y-6">
               <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                  <Award className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  Níveis do Programa
               </h3>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {loyaltySettings.levels_config.map((level, idx) => (
                     <Card key={idx} className={`p-6 border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden group ${level.active === false ? 'opacity-50 grayscale select-none' : ''}`}>
                        <div className={`absolute top-0 left-0 w-2 h-full ${level.active === false ? 'bg-gray-300' :
                           idx === 0 ? 'bg-orange-400' :
                              idx === 1 ? 'bg-slate-400' :
                                 idx === 2 ? 'bg-yellow-400' :
                                    'bg-cyan-400'
                           }`}></div>
                        <div className="flex justify-between items-start mb-4">
                           <Badge
                              color={idx === 3 ? 'diamond' : idx === 2 ? 'gold' : idx === 1 ? 'silver' : 'bronze'}
                              className="font-black uppercase tracking-widest text-[13px] px-3 py-1 flex items-center gap-1.5"
                           >
                              {idx === 0 ? '🥉' : idx === 1 ? '🥈' : idx === 2 ? '🥇' : '💎'} {level.name}
                           </Badge>
                           {idx > 0 && (
                              <button
                                 onClick={() => {
                                    const newLevels = [...loyaltySettings.levels_config];
                                    newLevels[idx].active = level.active === false ? true : false;
                                    setLoyaltySettings({ ...loyaltySettings, levels_config: newLevels });
                                 }}
                                 className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${level.active === false ? 'border-primary-500 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20' : 'border-red-400 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                              >
                                 {level.active === false ? 'Ativar' : 'Desativar'}
                              </button>
                           )}
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{idx === 0 ? 'Meta Geral' : 'Meta para Alcançar'}</label>
                              <input
                                 type="number"
                                 value={level.goal}
                                 onChange={e => {
                                    const newLevels = [...loyaltySettings.levels_config];
                                    newLevels[idx].goal = parseInt(e.target.value) || 0;
                                    setLoyaltySettings({ ...loyaltySettings, levels_config: newLevels });
                                 }}
                                 className="w-full h-10 px-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[15px] font-bold text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Pontos por Visita</label>
                              <input
                                 type="number"
                                 value={level.points_per_visit}
                                 onChange={e => {
                                    const newLevels = [...loyaltySettings.levels_config];
                                    newLevels[idx].points_per_visit = parseInt(e.target.value) || 1;
                                    setLoyaltySettings({ ...loyaltySettings, levels_config: newLevels });
                                 }}
                                 className="w-full h-10 px-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[15px] font-bold text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ponto por cadastro</label>
                              <input
                                 type="number"
                                 value={level.points_per_signup}
                                 onChange={e => {
                                    const newLevels = [...loyaltySettings.levels_config];
                                    newLevels[idx].points_per_signup = parseInt(e.target.value) || 0;
                                    setLoyaltySettings({ ...loyaltySettings, levels_config: newLevels });
                                 }}
                                 className="w-full h-10 px-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[15px] font-bold text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Prêmio do Nível</label>
                              <input
                                 type="text"
                                 placeholder="Ex: Corte grátis, 15% OFF"
                                 value={level.reward}
                                 onChange={e => {
                                    const newLevels = [...loyaltySettings.levels_config];
                                    newLevels[idx].reward = e.target.value.replace(/(?:^|\s)\S/g, a => a.toUpperCase());
                                    setLoyaltySettings({ ...loyaltySettings, levels_config: newLevels });
                                 }}
                                 className="w-full h-10 px-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[15px] font-bold text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                              />
                           </div>
                           {idx > 0 && (
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 whitespace-nowrap block">Dias sem pontuar para rebaixar</label>
                                 <input
                                    type="number"
                                    min="0"
                                    value={level.days_to_downgrade}
                                    onChange={e => {
                                       const newLevels = [...loyaltySettings.levels_config];
                                       newLevels[idx].days_to_downgrade = parseInt(e.target.value) || 0;
                                       setLoyaltySettings({ ...loyaltySettings, levels_config: newLevels });
                                    }}
                                    className="w-full h-10 px-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[15px] font-bold text-sm outline-none focus:ring-2 focus:ring-primary-500/20"
                                 />
                                 <p className="text-[9px] text-gray-400 font-bold ml-1 whitespace-nowrap block">Coloque 0 se não quiser que o cliente caia de nível.</p>
                              </div>
                           )}
                        </div>
                     </Card>
                  ))}
               </div>
            </div>
         </div>

         <div className="pt-6 mt-8 border-t border-gray-100 dark:border-gray-800">
            <Button
               className="w-full h-14 bg-primary-500 text-white shadow-xl shadow-slate-400/20 font-black text-sm uppercase tracking-widest rounded-[15px]"
               onClick={handleUpdateSettings}
               disabled={isLoading}
            >
               {isLoading ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
         </div>

         {modal.isOpen && (
            <StatusModal
               isOpen={modal.isOpen}
               title={modal.title}
               message={modal.message}
               type={modal.type}
               onConfirm={modal.onConfirm}
               confirmLabel={modal.confirmLabel}
               theme="accent"
               onClose={() => setModal(prev => ({ ...prev, isOpen: false, onConfirm: undefined }))}
            />
         )}
      </div>
   );
};