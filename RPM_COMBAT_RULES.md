# RPM Combat Rules v1

Цель: простая боевая система для маленькой веб-игры. `RPM` работает как здоровье и ресурс движения, скорость столкновения работает как сила удара, зона контакта работает как атака/броня.

## Управление Волчком

- Волчок следует за курсором с ограниченной максимальной скоростью.
- Если курсор движется медленно, волчок может идти почти точка-в-точку за ним.
- Если курсор движется быстрее максимальной скорости волчка, волчок отстает и догоняет курсор с собственной максимальной скоростью.
- Резкий перенос курсора в другую часть арены не дает волчку сверхускорение. Он просто начинает идти к новой цели со своей текущей доступной максимальной скоростью.
- При старте движения может быть короткая задержка реакции, чтобы волчок ощущался тяжелым.
- Когда волчок достигает неподвижного курсора, он не останавливается мгновенно: за счет инерции может немного перелететь цель и вернуться назад.
- Максимальная скорость движения зависит от текущего RPM: чем ниже `currentRPM`, тем медленнее волчок может следовать за курсором.

Минимальные параметры:

```text
position
velocity
targetPosition
currentRPM
maxRPM
baseMoveSpeed
movementDelay
arrivalOvershoot / damping
```

Пример зависимости скорости:

```text
rpmRatio = currentRPM / maxRPM
currentMoveSpeed = baseMoveSpeed * lerp(0.40, 1.0, rpmRatio)
```

## RPM

- `currentRPM` - текущее здоровье/обороты волчка.
- `maxRPM` - текущий максимум восстановления RPM.
- `absoluteMaxRPM` - round upper cap; current v1 value: `6000`.
- Даже без ударов RPM медленно гаснет: стартовое значение `rpmMaxDrain = 1 RPM/sec`.
- Пассивное затухание уменьшает `maxRPM`, а не только `currentRPM`.
- `currentRPM` никогда не может быть выше `maxRPM`.
- При ударе `currentRPM` уменьшается.
- Визуальная скорость вращения модели зависит от `currentRPM / absoluteMaxRPM`.
- После урона волчок может восстановить `currentRPM` только до текущего `maxRPM`.
- Восстановление идет от пройденного расстояния по арене, а не просто от времени.

Пример восстановления:

```text
currentRPM += distanceMoved * rpmRecoverPerMeter
currentRPM = min(currentRPM, maxRPM)
```

Current v1 `rpmRecoverPerMeter` value: `400`.

Порядок обновления RPM каждый кадр:

```text
maxRPM -= rpmMaxDrain * deltaTime
maxRPM = max(maxRPM, 0)

currentRPM += distanceMoved * rpmRecoverPerMeter
currentRPM = min(currentRPM, maxRPM)
currentRPM = max(currentRPM, 0)
```

Пример: если после удара `currentRPM = 50`, а `maxRPM = 70`, то потолок продолжает снижаться на `1 RPM/sec`. Если восстановление догонит потолок через 3 секунды, встреча произойдет уже около `67 RPM`, а не `70`.

## Срез Максимального RPM

После столкновения сравниваем, сколько урона волчок нанес и сколько получил.

Если волчок получил больше урона, чем нанес, его `maxRPM` уменьшается:

```text
damageDeficit = damageTaken - damageDealt
maxRpmLoss = min(damageDeficit, absoluteMaxRPM * 0.10)
maxRPM -= maxRpmLoss
```

То есть за одно плохое столкновение `maxRPM` можно срезать максимум на 10% от `absoluteMaxRPM`, но если разница урона меньше, срезается только эта меньшая разница.

## Сила Удара

Основной урон зависит от скорости столкновения:

```text
impactSpeed = скорость сближения двух волчков по линии столкновения
baseDamage = impactSpeed * damagePerSpeed
```

Если волчки трутся рядом и почти не перемещаются, отдельный `Clash`-режим не нужен: низкая скорость даст маленький урон сама по себе.

После сильного удара атакующий тоже получает небольшой recoil-урон:

```text
attackerRecoil = finalDamage * recoilMultiplier
```

Стартовые v1-значения для подбора:

```text
damagePerSpeed = 600
recoilMultiplier = 0.10-0.25
rpmMaxDrain = 1 RPM/sec
```

## Зоны Контакта

Зоны не привязаны к визуальному вращению модели. Они привязаны к направлению движения волчка:

```text
front = куда волчок сейчас едет или пытается ехать
back = противоположная сторона
side = левая или правая сторона
```

Зона контакта одновременно влияет на атаку и на броню:

```text
outgoingMultiplier - насколько хорошо зона наносит урон
incomingMultiplier - насколько зона уязвима при получении удара
```

Стартовые v1-множители:

```text
front:
  outgoingMultiplier = 1.00
  incomingMultiplier = 0.75

side:
  outgoingMultiplier = 0.80
  incomingMultiplier = 1.00

back:
  outgoingMultiplier = 0.20
  incomingMultiplier = 1.30
```

Итоговый урон:

```text
damageToTarget =
  baseDamage
  * attackerZone.outgoingMultiplier
  * targetZone.incomingMultiplier
```

## Критический Удар

Крит не случайный. Он срабатывает, когда волчок быстро попадает сильной зоной в слабую зону цели:

```text
attackerZone = front
targetZone = side или back
impactSpeed >= criticalSpeed
```

Эффект:

```text
damage *= criticalDamageMultiplier
knockback *= criticalKnockbackMultiplier
spawn critical VFX / sound
```

Стартовые v1-значения:

```text
criticalDamageMultiplier = 1.5
criticalKnockbackMultiplier = 1.4
```

## Что Не Делаем В v1

- Не вводим отдельное состояние `Clash`.
- Не определяем намерение игрока.
- Не вводим сложные классы брони или RPG-статы.
- Не делаем случайные криты.
- Не привязываем зоны к визуальному вращению модели.

V1 строится только на:

```text
скорость столкновения
зона атакующего
зона защищающегося
currentRPM / maxRPM
```
