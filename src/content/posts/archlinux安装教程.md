---
title: archlinux安装教程
published: 2026-05-07
pinned: false
description: 在virtualbox安装arch系统
tags: [Markdown, archlinux,虚拟机]
category: linux
draft: false
image: ./images/nn.jpg
---


# 										Arch Linux 安装笔记


virtualbox新建虚拟机时选择自己下载好的iso文件，会自动识别操作系统然后在下面的选项中分配合适的cup,内存，硬盘
需要注意的时记得勾选`使用EFI`这样启动时会使用UEFI而不是BISO

虚拟机装好iso后，打开，使用`setfont ter-v20n`调整文字大小

------

## 一、网络连接

如果是虚拟机里面的话是虚拟的有线网络，有线网是自动连接的，ping一下能连通就不用管网的事情了

------

## 二、时区设置

调整时区，`timedatectl`查看当前的时区，然后用`timedatectl set-timezone Asia/Shanghai`调整到本地时间

------

## 三、镜像源配置

然后这个命令选择镜像源

text

```
reflector -a 12 -c cn -f 10 --sort rate --v --save /etc/pacman.d/mirrorlist
```



- `-a 12`：选择最近12小时内同步的镜像
- `-c cn`：仅选择位于中国的镜像
- `-f 10`：获取前10个最快的镜像
- `--sort rate`：按评分排序
- `--v`：详细输出模式
- `--save /etc/pacman.d/mirrorlist`：保存结果到镜像列表文件

**注意：** 执行这个命令需要root权限，并且确保已安装`reflector`工具。（有的教程不建议这个，说是在某些特殊情况下会误删源信息，会覆盖 /etc/pacman.d/mirrorlist`）

`在2025年后，用于自动更新 mirrorlist（软件包管理器 pacman 的软件源）的 reflector 服务由于会误删某些有用的源信息已被默认禁用，无需再手动禁用。`(来自archlinux简明指南)

------

## 四、系统更新

然后更新安装包，pacman类似ubuntu的apt

text

```
pacman -Sy archlinux-keyring
```



- `-S`：同步（安装）软件包
- `-y`：刷新本地包数据库
- `archlinux-keyring`：Arch Linux官方密钥环包，包含用于验证软件包签名的信任密钥

**使用场景：**

- 遇到GPG密钥错误时
- 长时间未更新系统后
- 密钥过期或无效时

**注意：** 更新密钥环后，通常建议紧接着运行完整的系统更新：

text

```
pacman -Syu
```

------

## 五、磁盘分区

之后就是磁盘分区，`lsblk -pf`显示当前磁盘分区，在虚拟机里应该显示一个/dev/sda

然后`cfdisk /dev/sda`进行磁盘分区，会出现图形化界面，新的电脑选择gpt就行

分为2个区：sda1区（挂载启动程序）和sda2（用来放根目录）。分区根据自己内存大小分配，暂时不用分配swap区，之后可以动态分配。然后点击type把sda1区改为efi，sda2不用动，然后点击write再去退出，不然不会保存

然后`lsblk -pf`看看分区好了没有，好了会显示你刚才分区的内容，应该有sda1和sda2

------

## 六、格式化分区

之后就是挂载了，使用命令格式化分区

### 6.1 格式化EFI分区

text

```
mkfs.vfat /dev/sda1
```



**作用**：把`/dev/sda1`格式化为**FAT32**文件系统（vfat就是FAT32）

**为什么必须用vfat？**

- **UEFI固件只认识FAT32**！就像BIOS只认MBR一样
- EFI分区里存放的是**引导文件**（如`bootx64.efi`）
- 必须是FAT32，不能是ext4、xfs等

**注意**：EFI分区通常512MB或1GB，太小不够用，太大浪费。

### 6.2 格式化根分区

text

```
mkfs.btrfs -f /dev/sda2
```



**作用**：把`/dev/sda2`格式化为**btrfs文件系统**（btrfs有创建快照的功能）

**`-f`参数**：`--force`强制格式化（如果已有文件系统，覆盖它）

------

## 七、创建btrfs子卷

接着创建分卷，分卷是btrfs的，如果不创建分卷，快照的时候会把系统数据和用户数据一起存档，到时候回档的时候会把数据回档，可能造成几天白干的情况出现

text

```
mount -t btrfs /dev/sda2 /mnt
btrfs subvolume create /mnt/@
btrfs subvolume create /mnt/@home
```



根据自己的磁盘名创建

**命令说明：**

1. **`mount -t btrfs /dev/sda2 /mnt`**
   - 将Btrfs分区挂载到`/mnt`
   - `-t btrfs`：指定文件系统类型为Btrfs
2. **`btrfs subvolume create /mnt/@`**
   - 创建名为`@`的子卷，通常用作根目录
   - `@`是Arch Linux Btrfs安装的常见命名约定
3. **`btrfs subvolume create /mnt/@home`**
   - 创建名为`@home`的子卷，用于`/home`目录
   - 方便快照和回滚用户数据

------

## 八、挂载子卷和EFI分区

然后`lsblk -pf`应该可以看到/dev/sda2这个根分区挂载到了/mnt，我们先`umount /mnt`取消挂载，让root挂载到/mnt

然后umount

text

```
mount -t btrfs -o subvol=/@,compress=zstd /dev/sda2 /mnt
mount --mkdir -t btrfs -o subvol=/@home,compress=zstd /dev/sda2 /mnt/home
mount --mkdir /dev/sda1 /mnt/efi
```



**命令说明：**

1. **第一条命令：挂载根子卷**
   - `-o subvol=/@`：挂载名为`@`的子卷作为根目录
   - `compress=zstd`：启用Zstandard压缩算法（Btrfs压缩，性能好、压缩率高）
   - 挂载到`/mnt`作为系统安装目标
2. **第二条命令：挂载home子卷**
   - `--mkdir`：如果`/mnt/home`目录不存在则自动创建
   - `subvol=/@home`：挂载`@home`子卷
   - `compress=zstd`：同样启用压缩
   - 挂载到`/mnt/home`作为用户目录
3. **第三条命令：挂载efi分区（系统的启动文件）**
   注意看，前两条命令使用了压缩算法，而这一条没有使用。这是因为启动程序的分区有/boot /efi /boot/efi，这里挂载到/efi是因为esp（启动文件）不能被btrfs备份，所以不能用，不然会导致快照回档不能正确启动（到时候就重装吧（doge））

看到这可能有疑问了，这是在干什么，mnt是Linux的临时挂载点，*Btrfs必须先挂载分区才能创建子卷，创建完要卸载再按子卷挂载。*这一步其实是把根目录挂载到mnt上，即安装系统的时候暂时挂载到mnt，之后安装好后这个mnt变成根分区，然后你可以在这个根分区下重新创建mnt挂载光驱等，到之后arch-chroot切换根分区的时候就懂了

做完这一步后，执行`lsblk -pf`命令查看是否成功挂载

------

## 九、安装基础系统

安装基础系统

text

```
pacstrap -K /mnt base base-devel linux-zen linux-firmware btrfs-progs
```



| 参数/包名        | 作用                                         |
| :--------------- | :------------------------------------------- |
| `-K`             | 初始化pacman的密钥环（用于验证软件包签名）   |
| `/mnt`           | 安装目标位置（就是你刚才挂载的分区）         |
| `base`           | Arch的基础系统核心包                         |
| `base-devel`     | 编译工具链（gcc, make等），后续装AUR软件必备 |
| `linux-zen`      | Linux内核本身                                |
| `linux-firmware` | 各种硬件的固件（驱动），**非常重要**         |
| `btrfs-progs`    | btrfs文件系统管理工具（因为你用了btrfs）     |

这里时间可能会有点长，耐心等待哦（> _ <）

------

## 十、安装必要工具

下一步安装必要工具

text

```
pacstrap /mnt networkmanager vim sudo amd-ucode
```



随后的amd-ucode如果是intel用intel-ucode，不过虚拟机里面不影响

| 包名             | 作用                                   |
| :--------------- | :------------------------------------- |
| `networkmanager` | 网络管理工具（图形化和命令行管理网络） |
| `vim`            | 文本编辑器（比vi好用）                 |
| `sudo`           | 让普通用户获得管理员权限               |
| `amd-ucode`      | **AMD CPU微码更新**（修复CPU硬件bug）  |


------

## 十一、生成fstab

下一步，这一步完成后下次重启会按照fstab的内容自动挂载
text

```
genfstab -U /mnt > /mnt/etc/fstab
```



| 部分             | 作用                                           |
| :--------------- | :--------------------------------------------- |
| `genfstab`       | 生成fstab的工具                                |
| `-U`             | 使用**UUID**来标识分区（最推荐，最稳定）       |
| `/mnt`           | 检查这个目录下挂载了哪些分区                   |
| `>`              | 重定向符号，把输出写入文件                     |
| `/mnt/etc/fstab` | 目标文件（系统启动时会读取这个文件来挂载分区） |

------

## 十二、进入chroot环境

下一步`arch-chroot /mnt`

进入新安装的系统，现在知道为什么配置/mnt文件了吧，临时挂载，切换到这个文件之后这个就是新系统的根目录

------

## 十三、时区配置（chroot内）

进入后创建时区软连接，软链接类似快捷方式

text

```
ln -s /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
```



- `ln -s`：创建软链接（类似Windows的快捷方式）
- 源：`/usr/share/zoneinfo/Asia/Shanghai`（上海时区文件）
- 目标：`/etc/localtime`（系统时间配置文件）

这一步也可以用timedatectl（我去，不早说doge）


------

## 十四、硬件时钟

下一步用`hwclock --systohc`校准时钟

------

## 十五、本地化配置

下一步配置系统的**语言和字符编码**

下一步 `vim /etc/locale.gen`

这里常见的vim命令不在赘述

搜索en_US去除UTF-8的注释，搜索zh_CN去除UTF-8的注释，退出

`locale-gen`生成本地化文件

再接着`vim /etc/locale.conf`配置本地化文件，填上`LANG=en_US.UTF-8`

------

## 十六、主机名与密码

`vim /etc/hostname`设置主机名

然后`passwd`设置密码，密码存储在/etc/shadow

------

## 十七、安装引导程序

下一步

text

```
pacman -S grub efibootmgr
```



| 包名         | 作用                                         |
| :----------- | :------------------------------------------- |
| `grub`       | GRUB引导加载程序（GRand Unified Bootloader） |
| `efibootmgr` | 管理UEFI启动项的工具                         |

然后

text

```
grub-install --target=x86_64-efi --efi-directory=/efi --boot-directory=/efi --bootloader-id=eris
```



### 17.1 `grub-install`

- GRUB的安装命令
- 负责把GRUB的引导代码写入指定位置

### 17.2 `--target=x86_64-efi`

- **指定架构和固件类型**
- `x86_64`：64位系统
- `efi`：UEFI启动模式（而不是传统的BIOS）
- 这会在`/boot/grub`下生成`x86_64-efi`目录，存放GRUB模块

### 17.3 `--efi-directory=/efi`

- **指定EFI系统分区（ESP）的挂载点**
- `/efi`就是你之前挂载EFI分区的地方
- GRUB会在这里创建EFI应用程序：`/efi/EFI/eris/grubx64.efi`
- 这是UEFI固件真正启动的文件

### 17.4 `--boot-directory=/efi`

- **指定GRUB的核心目录位置**
- 正常情况下应该省略，默认是`/boot`
- 这里强行指定为`/efi`，因为btrfs的快照对/boot来说有问题

### 17.5 `--bootloader-id=eris`

- **指定UEFI启动菜单里显示的名称**
- 当你按F12选择启动设备时，会看到"eris"这个选项
- 可以是任意名字，比如"Arch Linux"、"GRUB"等

如果这里提示`/efi doesn't look like an EFI partition`，先exit退出然后`lsblk -pf`看看是否正确挂载efi和btrfs的子卷

------

## 十八、创建grub软链接

接下来

text

```
ln -s /efi/grub /boot/grub
```



- `ln -s`：创建软链接
- 源：`/efi/grub`（指向EFI分区里的grub目录）
- 目标：`/boot/grub`（在根分区创建链接）
- 因为grub默认在/boot

------

## 十九、生成GRUB配置

然后grub-mkconfig

## 这条命令是**生成GRUB配置文件**！这是安装GRUB的最后一步！

## 命令解析

text

```
grub-mkconfig -o /boot/grub/grub.cfg
```



- `grub-mkconfig`：GRUB配置生成工具
- `-o`：输出到指定文件
- `/boot/grub/grub.cfg`：GRUB的配置文件（启动菜单就从这里读取）

生成grub的配置文件，之后可以安全退出了，能自启动了

------

## 二十、优化：配置zram

接下来是优化

安装`pacman -S zram-generator`

**`zram`是什么**：它从你的内存（RAM）中划出一部分，经过压缩后当作交换分区（swap）来用。因为内存的速度比硬盘快得多，所以这样做能让系统在物理内存紧张时，处理速度比使用传统的硬盘swap快很多，从而提高整体响应速度

然后

text

```
vim /etc/systemd/zram-generator.conf
```



### 写入以下内容

text

```
[zram0]
zram-size = ram / 2
compression-algorithm = zstd
swap-priority = 100
```



## 配置参数详解

| 参数                    | 作用         | 推荐值                   |
| :---------------------- | :----------- | :----------------------- |
| `zram-size`             | zram设备大小 | `ram / 2`（内存的一半）  |
| `compression-algorithm` | 压缩算法     | `zstd`（最快且压缩率高） |
| `swap-priority`         | 交换优先级   | `100`（比硬盘swap高）    |

------

## 二十一、优化：禁用zswap

然后`vim /etc/default/grub`

配置自启动文件，`gg`跳到最上面，添加`zswap.enabled=0`

- **意思**：**禁用zswap**
- **zswap是什么**：
  - 内核的一个功能
  - 当内存快满时，先把数据**压缩后存在内存里**
  - 实在不行了才写到硬盘swap
- **为什么禁用zswap？**
  因为装了**`zram-generator`**！

| 特性     | zswap                            | zram                   |
| :------- | :------------------------------- | :--------------------- |
| 位置     | 内存里的一块缓存                 | 独立的压缩块设备       |
| 工作原理 | 截取要写到swap的数据，压缩后暂存 | 直接当swap用，压缩存储 |
| 最终去向 | 满了会解压写到硬盘               | 一直留在内存（压缩态） |


- zswap和zram都是做内存压缩的
- **同时启用会打架**，导致性能下降甚至死锁
- 你用`zram-generator`就**必须禁用zswap**

每次配置完grub后都要`grub-mkconfig -o /boot/grub/grub.cfg`让修改生效

------

## 二十二、重启

然后exit，接着reboot重启

把arch的启动项改为第一个

这里重启后如果不能自动进入可能是没有正确挂载或者启动的配置有问题或者少安装东西了

我有一次无法自动进入，手动进入后运行`lsblk -pf`发现不显示btrfs的子卷的挂载点，重新挂载提示已经挂载了，子卷的文件是存在的，于是乎，只能把挂载的文件删了重新挂载，这样操作之后，`reboot`就能自动进入系统了

------

## 二十三、首次进入系统

进入后输入root和密码，然后输入`systemctl enable --now NetworkManager`进入图形化界面配置网络选择active to connecting

Ping测试连没连上

------

## 二十四、 创建普通用户

日常使用建议使用普通用户，这是为了安全性考虑，防止进行某些比较危险的操作，比如`rm -rf /*`

```
useradd -mG wheel "用户名" 
```


useradd：创建新用户

-m：创建用户的主目录，会在 /home 下创建一个目录

-G：将这个用户加入另一个指定用户组中

wheel：这个用户组成员可以通过 sudo 执行 root 权限

然后`passwd "用户名"`设置密码

然后`visudo`编辑`sudoers`文件(sudo的配置文件是 sudoers 文件，它允许系统管理员集中的管理用户的使用权限和使用的主机。 它所存放的位置默认是在/etc/sudoers，属性必须为0411)

搜索`wheel`，解除`%wheel ALL=(ALL:ALL) ALL`的注释，赋予wheel组管理员权限

## 二十五 配置软件源

有些软件仍会使用32位软件源，所以需要配置

运行

```
vim /etc/pacman.conf
```
搜索 `multilib`，解除`[multilib]`的注释

另外在添加archlinuxcn的软件源

在文件最后添加

```
[archlinuxcn]
Server = https://mirrors.ustc.edu.cn/archlinuxcn/$arch
```

或者其他国内镜像

清华：`https://mirrors.tuna.tsinghua.edu.cn/archlinuxcn/$arch`

阿里云：`https://mirrors.aliyun.com/archlinuxcn/$arch`

配置完成后，退出，运行`sudo pacman -Syu archlinuxcn-keyring`

## 二十六 安装yay

众所周知，AUR 是arch的一大特色，几乎所有软件都可以从上面下载，所以为了方便使用AUR，我们来安装AUR助手yay

运行

```
pacman -S yay
```

注：如果后续使用yay安装时出现 数据库已被注册 的错误,运行

```
vim /etc/pacman.conf
```
看看是不是archlinuxcn源多写了一个，就是有多个`[archlinuxcn]`，只留一个就可以了

## 二十七、安装好玩的小工具

`pacman -S fastfetch cmatrix`

### `fastfetch` - 系统信息展示工具



```
fastfetch
```


执行后会显示一个漂亮的Arch Linux标志 + 系统信息（内核、CPU、内存等）

### `cmatrix` - 黑客帝国特效



```
cmatrix
```

------

## 🎉 恭喜！！！

恭喜！！！你已经安装好最基本的系统了！！！！

教程结束，旅途愉快！！！！！！


