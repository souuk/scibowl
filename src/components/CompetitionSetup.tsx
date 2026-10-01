import { defaultCompetition, type CompetitionConfig } from '../game/competition';
export function CompetitionSetup({ value, onChange }: { value: CompetitionConfig | null; onChange: (v: CompetitionConfig | null) => void }) {
  return <fieldset><legend>Rules and match format</legend>
    <label>Rule set<select aria-label="Rule set" value={value ? 'competition' : 'simplified'} onChange={e => onChange(e.target.value === 'competition' ? defaultCompetition : null)}><option value="competition">DOE 2026 in-person competition</option><option value="simplified">Simplified practice (no rebounds or penalties)</option></select></label>
    {value && <><div className="team-inputs"><label>School level<select value={value.level} onChange={e => onChange({ ...value, level: e.target.value as CompetitionConfig['level'] })}><option value="middle">Middle school</option><option value="high">High school</option></select></label>
      <label>Event<select value={value.venue} onChange={e => onChange({ ...value, venue: e.target.value as CompetitionConfig['venue'], longBreak: false })}><option value="regional">Regional — 8-minute halves</option><option value="national">National — 10-minute halves</option><option value="national-visual">National visual round — 12-minute halves</option></select></label>
      <label>Format<select value={value.format} onChange={e => onChange({ ...value, format: e.target.value as CompetitionConfig['format'] })}><option value="round-robin">Round robin (ties allowed)</option><option value="elimination">Elimination (five-question tiebreaks)</option><option value="two-team-tiebreak">Two-team tiebreak only</option><option value="multi-team-tiebreak">Multi-team qualifying tiebreak — one team per room</option><option value="practice">Untimed practice with competition question rules</option></select></label></div>
      {value.venue !== 'regional' && <label><input type="checkbox" checked={value.longBreak} onChange={e => onChange({ ...value, longBreak: e.target.checked })} />National elimination round 10/11: five-minute break</label>}
      <p>Both levels use the same question rules. National middle-school division ties use head-to-head results and qualifying tiebreaks; high-school division ties use Division Team Challenge rankings, recorded by tournament officials.</p>
      {value.format === 'multi-team-tiebreak' && <p>Only Team A plays. Use the same five questions for each tied team in separate rooms: +1 correct, −1 incorrect, zero for no answer or communication. Tournament standings are managed outside this app.</p>}
    </>}
  </fieldset>;
}
