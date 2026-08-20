'use client';

import { useState, useTransition } from 'react';
import { updateGoals } from '@/app/actions';
import { ALLERGEN_LABELS, FILTERABLE_PROPERTIES, propertyLabel } from '@/lib/labels';
import type { ProfileRow } from '@/lib/supabase/database.types';

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function SettingsForm({ profile }: { profile: ProfileRow }) {
  const [calorieGoal, setCalorieGoal] = useState(String(profile.calorie_goal));
  const [proteinGoal, setProteinGoal] = useState(String(profile.protein_goal_g));
  const [carbGoal, setCarbGoal] = useState(String(profile.carb_goal_g));
  const [fatGoal, setFatGoal] = useState(String(profile.fat_goal_g));
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>(profile.dietary_prefs);
  const [allergensAvoid, setAllergensAvoid] = useState<string[]>(profile.allergens_avoid);

  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setError(null);

    startTransition(async () => {
      const result = await updateGoals({
        calorieGoal: Number(calorieGoal),
        proteinGoal: Number(proteinGoal),
        carbGoal: Number(carbGoal),
        fatGoal: Number(fatGoal),
        dietaryPrefs,
        allergensAvoid,
      });

      if (result.ok) setStatus('Settings saved.');
      else setError(result.error ?? 'Could not save your settings.');
    });
  }

  const numberField = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    unit: string,
  ) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="data w-full rounded-lg border border-rule bg-paper-raised px-3 py-2.5"
        />
        <span className="w-8 text-sm text-ink-soft">{unit}</span>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section>
        <h2 className="signage border-b-2 border-rule-strong pb-1 text-lg">Daily goals</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {numberField('calories', 'Calories', calorieGoal, setCalorieGoal, 'cal')}
          {numberField('protein', 'Protein', proteinGoal, setProteinGoal, 'g')}
          {numberField('carbs', 'Carbs', carbGoal, setCarbGoal, 'g')}
          {numberField('fat', 'Fat', fatGoal, setFatGoal, 'g')}
        </div>
      </section>

      <section>
        <h2 className="signage border-b-2 border-rule-strong pb-1 text-lg">
          Dietary preferences
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          These turn on as filters when you open a menu.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERABLE_PROPERTIES.map((prop) => {
            const on = dietaryPrefs.includes(prop);
            return (
              <button
                key={prop}
                type="button"
                onClick={() => setDietaryPrefs(toggle(dietaryPrefs, prop))}
                aria-pressed={on}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  on ? 'bg-navy text-paper-raised' : 'border border-rule bg-paper-raised'
                }`}
              >
                {propertyLabel(prop)}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="signage border-b-2 border-rule-strong pb-1 text-lg">Allergens</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Items containing these get a warning on the menu. They stay visible — UNC cooks in a
          shared kitchen, so always check with staff if it matters.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(ALLERGEN_LABELS).map(([key, label]) => {
            const on = allergensAvoid.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setAllergensAvoid(toggle(allergensAvoid, key))}
                aria-pressed={on}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  on
                    ? 'border border-danger bg-danger-bg text-danger'
                    : 'border border-rule bg-paper-raised'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {status && (
        <p role="status" className="text-sm font-medium text-carolina">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-navy py-3 text-sm font-semibold text-paper-raised disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  );
}
