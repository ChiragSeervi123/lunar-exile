export interface InventoryStack {
  itemId: string
  quantity: number
}

export type EquipmentSlot = 'suit' | 'tool' | 'weapon' | 'backpack'

export type Equipment = Partial<Record<EquipmentSlot, string>>
