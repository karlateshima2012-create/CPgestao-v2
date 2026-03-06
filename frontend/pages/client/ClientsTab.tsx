import React, { useState } from 'react';
import { Search, Plus, MapPin, Star, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Button, Badge } from '../../components/ui';
import { Contact } from '../../types';

interface ClientsTabProps {
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onRefresh: () => void;
}

export const ClientsTab: React.FC<ClientsTabProps> = ({ contacts, onEdit, onDelete, onNew, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filtered = (contacts || []).filter(c => {
    if (!c) return false;
    const s = (search || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const phone = (c.phone || '').replace(/\D/g, '');
    const searchPhone = s.replace(/\D/g, '');
    const city = (c.city || '').toLowerCase();

    return name.includes(s) || email.includes(s) || (searchPhone && phone.includes(searchPhone)) || city.includes(s);
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Base de Clientes</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-lg text-left">Gerencie seu portfólio de {contacts.length} clientes.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onRefresh} className="h-11 px-6 rounded-xl text-[11px] font-black uppercase tracking-widest border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all">
            Atualizar
          </Button>
          <Button onClick={onNew} className="h-11 px-6 rounded-xl text-[11px] font-black uppercase tracking-widest bg-primary-500 text-white shadow-lg shadow-slate-400/20 hover:bg-primary-700 transition-all">
            + Novo Cliente
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-xl shadow-gray-200/50 dark:shadow-none bg-white dark:bg-gray-900 rounded-[24px] overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/50">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou e-mail..."
              className="w-full h-12 pl-12 pr-4 bg-white dark:bg-gray-800 border-none rounded-[16px] text-sm font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500/20 shadow-sm outline-none transition-all"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Cliente</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Cidade</th>
                <th className="px-8 py-5 text-center text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Pontos</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {paginatedData.map((contact) => (
                <tr
                  key={contact.id}
                  className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-all duration-200 cursor-pointer"
                  onClick={() => onEdit(contact)}
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-black text-gray-700 dark:text-gray-300 shadow-inner group-hover:bg-white dark:group-hover:bg-gray-700 transition-colors">
                        {contact.photo_url_full ? (
                          <img src={contact.photo_url_full} alt={contact.name} className="w-full h-full object-cover" />
                        ) : (
                          (contact.name || '?')[0].toUpperCase()
                        )}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-gray-900 dark:text-white text-sm tracking-tight">{contact.name || 'Sem Nome'}</span>
                          <Badge color={contact.loyaltyLevel === 4 ? 'diamond' : contact.loyaltyLevel === 3 ? 'gold' : contact.loyaltyLevel === 2 ? 'silver' : 'bronze'}>
                            {contact.loyalty_level_name || (
                              contact.loyaltyLevel === 4 ? '💎 Diamante' :
                                contact.loyaltyLevel === 3 ? '🥇 Ouro' :
                                  contact.loyaltyLevel === 2 ? '🥈 Prata' :
                                    '🥉 Bronze'
                            )}
                          </Badge>
                        </div>
                        <div className="flex flex-col mt-0.5">
                          {contact.company_name && (
                            <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest">{contact.company_name}</span>
                          )}
                          <span className="text-xs text-gray-400 font-medium tracking-tight">
                            {(contact.phone || '').replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-wide">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {contact.city || '---'}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <div className="inline-flex flex-col">
                      <span className="text-lg font-black text-gray-900 dark:text-white leading-none">{contact.pointsBalance || 0}</span>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Pontos</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(contact); }}
                        className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-all shadow-sm hover:shadow-md border border-transparent hover:border-gray-100 dark:hover:border-gray-700"
                        title="Ver Ficha"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(contact.id); }}
                        className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-all shadow-sm hover:shadow-md border border-transparent hover:border-gray-100 dark:hover:border-gray-700"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Página {currentPage} de {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider gap-2 bg-gray-50 dark:bg-gray-800 border-none hover:bg-gray-100"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Anterior
              </Button>
              <div className="flex items-center gap-1 mx-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 rounded-xl text-[10px] font-black transition-all ${currentPage === page ? 'bg-primary-500 text-white shadow-lg shadow-slate-400/20' : 'text-gray-400 hover:bg-gray-50'}`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider gap-2 bg-gray-50 dark:bg-gray-800 border-none hover:bg-gray-100"
              >
                Próximo <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
