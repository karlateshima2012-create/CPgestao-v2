import sys

file_path = '/Users/karlateshima/Developer/CPgestao-v2/frontend/pages/PublicTerminal.tsx'

with open(file_path, 'r') as f:
    lines = f.readlines()

# find index for line 784 (which is 783 in 0-indexed)
start_tag = "{mode === 'LOJISTA_ACTIONS' && foundCustomer && (() => {"
start_index = -1
for i, line in enumerate(lines):
    if start_tag in line:
        start_index = i
        break

if start_index == -1:
    print("Could not find start index")
    sys.exit(1)

# find end index (was around 890)
end_tag = ")()}"
end_index = -1
for i in range(start_index, len(lines)):
    if end_tag in lines[i]:
        end_index = i
        break

if end_index == -1:
    print("Could not find end index")
    sys.exit(1)

# The new cleaned up Lojista Actions block
new_block = """        {mode === 'LOJISTA_ACTIONS' && foundCustomer && (() => {
          const levelIdx = Math.max(0, (Number(foundCustomer.loyalty_level) || 1) - 1);
          const goal = Number(foundCustomer.points_goal || storeInfo?.levels_config?.[levelIdx]?.goal || storeInfo.points_goal);
          const balance = Number(foundCustomer.points_balance);
          const remaining = Math.max(0, goal - balance);
          const canRedeem = balance >= goal;

          return (
            <div className="p-6 md:p-10 text-center animate-fade-in space-y-8 w-full">
              <div className="space-y-4">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <UserCheck className="w-10 h-10 text-slate-900 dark:text-white" />
                </div>
                <div className="space-y-1">
                  <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${canRedeem ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`}>
                    {canRedeem ? 'META ATINGIDA - PREMIAR' : 'Confirmar Atendimento'}
                  </h3>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{foundCustomer.name}</h2>
                  <p className="text-sm font-bold text-slate-500">{foundCustomer.phone}</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Atual</p>
                  <p className="text-4xl font-black text-slate-900 dark:text-white">{balance} pts</p>
                </div>

                <div className="pt-2">
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-800 dark:bg-blue-500 transition-all duration-1000"
                      style={{ width: `${Math.min(100, (balance / (goal || 1)) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="mt-2 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase text-left">
                    <div className="flex flex-col">
                      <span>Meta: {goal} pts</span>
                      {!canRedeem && <span className="text-slate-500 normal-case opacity-60">Faltam {remaining} pts</span>}
                    </div>
                    {canRedeem && (
                      <span className="text-amber-600 dark:text-amber-400 animate-pulse font-black text-right tracking-tighter">🏆 META ATINGIDA!</span>
                    )}
                  </div>

                  {canRedeem && (
                    <div className="mt-4 p-5 bg-amber-500 rounded-[25px] shadow-lg shadow-amber-500/20 text-white animate-pulse">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-black uppercase tracking-widest bg-white/20 py-1 px-3 rounded-full self-center mb-2">Resgate Disponível</span>
                        <span className="text-xl md:text-2xl font-black uppercase tracking-tighter leading-none">META ATINGIDA - PREMIAR</span>
                      </div>
                    </div>
                  )}

                  {!canRedeem && remaining === 1 && (
                    <div className="mt-3 text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight text-center bg-blue-50 dark:bg-blue-900/20 py-2 rounded-lg border border-blue-100 dark:border-blue-900/30">
                      🎁 O cliente está a apenas 1 ponto de atingir a meta!
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {canRedeem ? (
                  <Button
                    onClick={() => handleAction('redeem')}
                    isLoading={loading}
                    className="h-24 bg-amber-500 hover:bg-amber-600 text-white rounded-[22px] font-black uppercase tracking-widest text-lg shadow-xl shadow-amber-500/30 transition-all flex flex-col items-center justify-center gap-0 group border-none"
                  >
                    <div className="flex items-center gap-3">
                      <Gift className="w-8 h-8 animate-bounce" />
                      <span>PRÊMIO ENTREGUE</span>
                    </div>
                    <span className="text-[10px] opacity-90 font-bold tracking-tight normal-case mt-1">(esta ação reiniciará o ciclo do cliente)</span>
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleAction('earn')}
                    isLoading={loading}
                    className="h-20 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black uppercase tracking-widest text-lg shadow-xl shadow-green-600/20 transition-all flex flex-col items-center justify-center gap-0 group"
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      <span>Dê +{(() => {
                        const lIdx = Math.max(0, (Number(foundCustomer.loyalty_level) || 1) - 1);
                        return storeInfo?.levels_config?.[lIdx]?.points_per_visit || 1;
                      })()} Pontos</span>
                    </div>
                    <span className="text-[10px] opacity-80 font-bold tracking-tight normal-case">Pontuação do Nível {foundCustomer.loyalty_level_name || 'Atual'}</span>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  onClick={reset}
                  className="h-12 text-slate-400 font-bold uppercase tracking-widest text-xs hover:text-slate-600"
                >
                  CANCELAR
                </Button>
              </div>
            </div>
          );
        })()}
"""

new_lines = lines[:start_index] + [new_block + "\n"] + lines[end_index+1:]

with open(file_path, 'w') as f:
    f.writelines(new_lines)

print("Successfully cleaned up PublicTerminal.tsx")
