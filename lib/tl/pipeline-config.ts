// Mirrors the category/stage mapping from sync/config.py

export interface Stage {
  id:   string
  name: string
}

export interface Category {
  name:   string
  stages: Stage[]
}

export const PIPELINE_CATEGORIES: Category[] = [
  {
    name: 'NYE LEADS',
    stages: [
      { id: '5095786727', name: 'Pool winback leads' },
      { id: '1446317287', name: 'Lead qualification' },
      { id: '188841923',  name: 'Nye leads' },
      { id: '1992087774', name: 'Ferdig estimert' },
    ],
  },
  {
    name: 'KF1',
    stages: [
      { id: '74384847', name: 'Kontaktforsøk 1 + SMS' },
    ],
  },
  {
    name: 'TIL PLATTFORM',
    stages: [
      { id: '1795037396', name: 'Henter inn bud' },
      { id: '434020796',  name: 'Venter på bud' },
      { id: '519657156',  name: 'Tilbud klart' },
      { id: '519657157',  name: 'KF1' },
      { id: '519657158',  name: 'KF2' },
    ],
  },
  {
    name: 'CLOSING',
    stages: [
      { id: '431588053',  name: 'Send tilbud' },
      { id: '189321201',  name: 'Lead, tilbud sendt' },
      { id: '122403776',  name: 'KF1 + SMS, lead' },
      { id: '122403777',  name: 'KF2, lead' },
      { id: '141045495',  name: 'I dialog med kunde' },
      { id: '185258735',  name: 'Hot lead' },
    ],
  },
  {
    name: 'VERIFIKASJON/SLUTTFØRING',
    stages: [
      { id: '188827594',  name: 'Videovisning avtalt' },
      { id: '188827595',  name: 'Videovisning under arbeid' },
      { id: '188827596',  name: 'Aksept/Kontrakt' },
      { id: '188827597',  name: 'Kontrakt signert' },
      { id: '3677025490', name: 'Rebil salgshjeeeelp' },
    ],
  },
  {
    name: 'KF2',
    stages: [
      { id: '71217910', name: 'Kontaktforsøk 2' },
    ],
  },
  {
    name: 'INNBYTTE',
    stages: [
      { id: '4610331873', name: 'Innbytte - send til Retail' },
    ],
  },
]

export const ALL_STAGES = PIPELINE_CATEGORIES.flatMap(c => c.stages)
