import { useEffect } from 'react';
import { Header } from './Shell';
import { Landing, Mission, JourneyMap } from './Intro';
import { isUnlocked, StationId, STATION_ORDER, useStore } from './store';
import { DataEngineering } from './DataEngineering';
import { DataAnalysis } from './DataAnalysis';
import { DataScience } from './DataScience';
import { MLEngineering } from './MLEngineering';
import { BusinessIntelligence } from './BusinessIntelligence';
import { Governance } from './Governance';
import { CompletedSystem } from './CompletedSystem';
import { CareerDiscovery } from './CareerDiscovery';
import { Completion } from './Completion';
import { Ramadan } from './Ramadan';
import { PresenterBar } from './Shell';
import { GlossaryHost } from './Glossary';
import { AchievementWatcher } from './Achievements';

const STATION_COMPONENTS: Record<StationId, () => JSX.Element> = {
  de: DataEngineering,
  da: DataAnalysis,
  ds: DataScience,
  ml: MLEngineering,
  bi: BusinessIntelligence,
  gov: Governance,
};

export default function App() {
  const { state, go } = useStore();
  const { screen } = state;

  useEffect(() => {
    document.documentElement.classList.toggle('presenter', state.presenter);
  }, [state.presenter]);

  // guard: a locked station (e.g. stale saved state) falls back to the map — never a dead end
  useEffect(() => {
    if ((STATION_ORDER as string[]).includes(screen) && !isUnlocked(state, screen as StationId)) go('map');
    if ((screen === 'system' || screen === 'ramadan' || screen === 'career' || screen === 'done') && !state.completed.gov && !state.presenter) go('map');
  }, [screen, state, go]);

  let body: JSX.Element;
  if (screen === 'landing')
    return (
      <>
        <Landing />
        <GlossaryHost />
        <PresenterBar />
      </>
    );
  else if (screen === 'mission') body = <Mission />;
  else if (screen === 'ramadan') body = <Ramadan />;
  else if (screen === 'map') body = <JourneyMap />;
  else if (screen === 'system') body = <CompletedSystem />;
  else if (screen === 'career') body = <CareerDiscovery />;
  else if (screen === 'done') body = <Completion />;
  else {
    const C = STATION_COMPONENTS[screen];
    body = <C key={screen} />;
  }
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:right-2 bg-white p-2 rounded z-50">
        تخطَّ إلى المحتوى
      </a>
      <Header />
      <main id="main" className="flex-1">
        {body}
      </main>
      <GlossaryHost />
      <PresenterBar />
      <AchievementWatcher />
    </div>
  );
}
