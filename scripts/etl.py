# Deterministic ETL: raw CSVs -> src/data/dashboard.json
import pandas as pd, numpy as np, json, sys
U=sys.argv[1] if len(sys.argv)>1 else '/mnt/user-uploads/'
t=pd.read_csv(U+'ef56a2c7-7840-454e-ab7e-a0df87b90bc5-tickets.csv')
o=pd.read_csv(U+'6990ae61-2433-405d-a790-24fda9cb7743-orders.csv')
a=pd.read_csv(U+'8fb10115-c45d-42dc-9e04-95154d9c3e41-agents.csv')
p=pd.read_csv(U+'c59ac66f-a215-4a8a-8dfe-39fc4db60f5c-products.csv')
checks=[]
for c in ['created_at','first_response_at','resolved_at']: t[c]=pd.to_datetime(t[c])
raw_h=(t.resolved_at-t.first_response_at).dt.total_seconds()/3600
neg_before=int((raw_h<0).sum())
# Trap 1: legacy resolved_at is UTC -> IST
leg=t.source_system=='legacy_fd'
t.loc[leg,'resolved_at']=t.loc[leg,'resolved_at']+pd.Timedelta(hours=5,minutes=30)
t['handle_h']=(t.resolved_at-t.first_response_at).dt.total_seconds()/3600
neg_after=int((t.handle_h<0).sum())
checks.append({"check":"Legacy resolution times shifted UTC->IST","before":neg_before,"after":neg_after,"unit":"negative handle times"})
t['frt_min']=(t.first_response_at-t.created_at).dt.total_seconds()/60
tgt={'chat':15,'voice':120,'social':240,'email':480}
t['breach']=t.frt_min>t.channel.map(tgt)
t['attended']=t.status.isin(['resolved','closed'])
t['repl']=t.replacement_issued.eq('Y')
# Trap 2: agents joined on agent_id (names collide)
dupnames=a[a.name.duplicated(keep=False)][['agent_id','name','team']].to_dict('records')
checks.append({"check":"Agents joined on ID, not name","before":len(dupnames),"after":0,"unit":"shared display names","detail":dupnames})
ag=a.sort_values('from_date').groupby('agent_id').last().reset_index()
t=t.merge(ag[['agent_id','name','site','team','shift','tier']],on='agent_id',how='left')
# Trap 3: lot join with fallback customer+sku
o['order_date']=pd.to_datetime(o.order_date)
t=t.merge(o[['order_id','lot_code']],on='order_id',how='left')
miss=t.lot_code.isna()
before_lot=int(miss.sum())
last=o.sort_values('order_date').groupby(['customer_id','sku']).lot_code.last()
t.loc[miss,'lot_code']=[last.get((c,s)) for c,s in zip(t.loc[miss,'customer_id'],t.loc[miss,'product_sku'])]
checks.append({"check":"Missing order IDs matched via customer+product","before":before_lot,"after":int(t.lot_code.isna().sum()),"unit":"tickets without lot"})
t['lot_month']=t.lot_code.str.extract(r'-(\d{4})-')[0]
t['festive_lot']=(t.product_sku=='VA-EB-PL2')&t.lot_month.isin(['2510','2511','2512'])
# Trap 4: CSAT blank = no response
checks.append({"check":"Blank CSAT excluded (not zero)","before":int(t.csat_score.isna().sum()),"after":0,"unit":"blank scores treated as 0"})
# Fair model: expected CSAT from queue mix (category x channel x defect-lot), shrunk
s=t[t.csat_score.notna()].copy()
g=s.csat_score.mean()
cell=s.groupby(['category','channel','festive_lot']).csat_score.agg(['mean','count'])
cell['exp']=(cell['mean']*cell['count']+g*20)/(cell['count']+20)
s=s.join(cell['exp'],on=['category','channel','festive_lot'])
s['resid']=s.csat_score-s.exp
hc=t[t.attended&t.handle_h.notna()].copy()
hcell=hc.groupby(['category','channel']).handle_h.median()
hc=hc.join(hcell.rename('exp_h'),on=['category','channel'])
agents=[]
for aid,grp in t.groupby('agent_id'):
    r=ag[ag.agent_id==aid].iloc[0]; sc=s[s.agent_id==aid]; h=hc[hc.agent_id==aid]
    n=len(sc); res=sc.resid.mean() if n else 0; se=sc.resid.std()/np.sqrt(n) if n>1 else 1
    k=15; shr=res*n/(n+k)
    agents.append(dict(id=aid,name=r['name'],team=r.team,site=r.site,shift=r.shift,tier=int(r.tier),
      tickets=len(grp),csat_n=n,csat=round(sc.csat_score.mean(),2),expected=round(sc.exp.mean(),2),
      residual=round(res,3),shrunk=round(shr,3),ci_lo=round(res-1.96*se,3),ci_hi=round(res+1.96*se,3),
      handle_med=round(h.handle_h.median(),1),handle_exp=round(h.exp_h.median(),1),
      handle_ratio=round((h.handle_h/h.exp_h.replace(0,np.nan)).median(),2),
      breach_rate=round(grp.breach.mean(),3),festive_share=round(grp.festive_lot.mean(),3),
      hardware_share=round(grp.category.isin(['Charging & Battery','Audio Quality','Connectivity','Hardware Fault']).mean(),3),
      night_share=round((r.shift=='Night')*1.0,1)))
A=pd.DataFrame(agents)
A['naive_rank']=A.csat.rank(method='first').astype(int)
A['naive_bottom10']=A.naive_rank<=10
A['flag']=(A.tier==1)&(A.csat_n>=30)&(A.ci_hi<0)&(A.shrunk<-0.15)
A['flag_reason']=np.where(A.tier==2,'Tier 2 - excluded by policy s.6',np.where(A.csat_n<30,'Too few surveys',np.where(A.flag,'CSAT below queue expectation (95% CI < 0)','Within expected range')))
# Lots
L=t[t.product_sku.isin(['VA-EB-PL2','VA-EB-PL1'])].groupby(['product_sku','lot_code']).agg(tickets=('ticket_id','count'),repl=('repl','sum'),csat=('csat_score','mean')).reset_index()
L['rate']=L.repl/L.tickets
lots=L.round(3).fillna(0).to_dict('records')
fest=t[t.festive_lot]; base=t[~t.festive_lot]
base_rate=base.repl.mean()
excess=fest.repl.sum()-base_rate*len(fest)
uc=p.set_index('sku').unit_cost_inr
policy_cost=uc['VA-EB-PL2']+340
contacts_per=round(t[t.repl].groupby('customer_id').size().mean(),2)
loaded=policy_cost+290*2+305
monthly=t.assign(m=t.created_at.dt.to_period('M').astype(str)).groupby('m').agg(tickets=('ticket_id','count'),csat=('csat_score','mean'),repl=('repl','sum'),festive=('festive_lot','sum')).reset_index().round(2).to_dict('records')
cat=t.groupby('assigned_team').agg(csat=('csat_score','mean'),tickets=('ticket_id','count')).round(2).reset_index().to_dict('records')
breach_cost=int(t[t.attended&t.breach].shape[0]*350)
out=dict(
 kpis=dict(tickets=len(t),agents=len(A),csat=round(g,2),csat_responses=int(len(s)),repl=int(t.repl.sum()),breaches=int(t.breach.sum()),
   festive_tickets=int(len(fest)),festive_repl=int(fest.repl.sum()),festive_rate=round(fest.repl.mean(),3),festive_csat=round(fest.csat_score.mean(),2),
   base_rate=round(base_rate,3),base_csat=round(base.csat_score.mean(),2),excess_repl=int(round(excess)),policy_cost=int(policy_cost),loaded_cost=int(loaded),
   excess_policy_inr=int(round(excess*policy_cost)),excess_loaded_inr=int(round(excess*loaded)),breach_credit_inr=breach_cost,training_budget=400000,
   naive_bottom_tier2=int((A.naive_bottom10&(A.tier==2)).sum()),naive_bottom_flagged=int((A.naive_bottom10&A.flag).sum()),flagged=int(A.flag.sum())),
 agents=A.round(3).replace({np.nan:None}).to_dict('records'),lots=lots,monthly=monthly,teams=cat,checks=checks)
json.dump(out,open('src/data/dashboard.json','w'),default=lambda x: x.item() if hasattr(x,'item') else str(x))
print(json.dumps(out['kpis'],indent=1,default=str))
print(A[A.flag|A.naive_bottom10][['id','name','team','csat','expected','shrunk','ci_hi','flag','naive_bottom10']])
